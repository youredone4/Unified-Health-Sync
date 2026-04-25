import { db } from "../db";
import {
  workforceMembers,
  workforceCredentials,
  UserRole,
} from "@shared/schema";
import { and, eq, isNull, lte, gte, or, inArray } from "drizzle-orm";
import type { ReportDefinition } from "./types";

/**
 * Nurses Roster — per-nurse line list of every NURSE on the LGU's HRH
 * roster who was active at any point during the picked calendar year.
 * Complements the aggregate HRH Quarterly Roster (NHWSS), which is a
 * grid of counts; this is the underlying detail.
 *
 * Includes PRC license + expiry, facility/barangay assignment,
 * employment status, hire/separation dates, contact, and the list of
 * recorded clinical credentials (BLS, ACLS, IMCI, etc.).
 *
 * Restricted to MGMT roles — TLs don't see other barangays' nurses,
 * and the page 403s on direct call.
 */
export const nursesRoster: ReportDefinition = {
  slug: "nurses-roster",
  title: "Nurses Roster",
  description:
    "Per-nurse line list with PRC license, expiry, assignment, employment status, contact, and credentials. " +
    "MHO / SHA / Admin only.",
  cadence: "annual",
  category: "performance",
  source: "workforce_members + workforce_credentials · DOH HHRDB",
  requiredRoles: [UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA],
  async fetch({ fromDate, toDate, barangay }) {
    const conds: any[] = [eq(workforceMembers.profession, "NURSE")];
    // Active during the year: not separated before year-start AND not
    // hired after year-end. Null hire / separation dates are treated as
    // "always" (i.e. on either end of the timeline).
    conds.push(
      or(
        isNull(workforceMembers.dateSeparated),
        gte(workforceMembers.dateSeparated, fromDate),
      ),
    );
    conds.push(
      or(
        isNull(workforceMembers.dateHired),
        lte(workforceMembers.dateHired, toDate),
      ),
    );
    if (barangay) conds.push(eq(workforceMembers.barangay, barangay));

    const members = await db.select().from(workforceMembers).where(and(...conds));

    // Pull credentials for the matched members in one round-trip.
    const creds = members.length
      ? await db
          .select()
          .from(workforceCredentials)
          .where(inArray(workforceCredentials.memberId, members.map((m) => m.id)))
      : [];
    const credsByMember: Record<number, string[]> = {};
    for (const c of creds) {
      (credsByMember[c.memberId] ??= []).push(c.credentialType);
    }

    // PRC license expiry status, for a quick at-a-glance flag.
    const today = new Date().toISOString().slice(0, 10);
    const ninetyDaysOut = new Date();
    ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90);
    const ninetyDaysOutIso = ninetyDaysOut.toISOString().slice(0, 10);
    const licenseStatus = (expiry: string | null) => {
      if (!expiry) return "—";
      if (expiry < today) return "EXPIRED";
      if (expiry < ninetyDaysOutIso) return "Expires <90d";
      return "Active";
    };

    return {
      columns: [
        { key: "fullName", label: "Name", align: "left" },
        { key: "prcLicense", label: "PRC License #", align: "left" },
        { key: "prcExpiry", label: "License Expiry", align: "left" },
        { key: "licenseStatus", label: "Status", align: "left" },
        { key: "facilityType", label: "Facility", align: "left" },
        { key: "barangay", label: "Barangay", align: "left" },
        { key: "employmentStatus", label: "Employment", align: "left" },
        { key: "dateHired", label: "Hired", align: "left" },
        { key: "dateSeparated", label: "Separated", align: "left" },
        { key: "contact", label: "Contact #", align: "left" },
        { key: "email", label: "Email", align: "left" },
        { key: "credentials", label: "Credentials", align: "left" },
      ],
      rows: members
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .map((m) => ({
          id: String(m.id),
          cells: {
            fullName: m.fullName,
            prcLicense: m.prcLicenseNumber ?? "",
            prcExpiry: m.prcLicenseExpiry ?? "",
            licenseStatus: licenseStatus(m.prcLicenseExpiry),
            facilityType: m.facilityType ?? "",
            barangay: m.barangay ?? "—",
            employmentStatus: m.employmentStatus,
            dateHired: m.dateHired ?? "",
            dateSeparated: m.dateSeparated ?? "",
            contact: m.contactNumber ?? "",
            email: m.email ?? "",
            credentials: (credsByMember[m.id] ?? []).sort().join(", "),
          },
        })),
      meta: {
        sourceCount: members.length,
        notes:
          `${members.length} nurse${members.length === 1 ? "" : "s"} active during the period` +
          `${barangay ? ` in ${barangay}` : ""}.`,
      },
    };
  },
};
