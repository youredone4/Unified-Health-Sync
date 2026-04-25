import { db } from "../db";
import { users, userBarangays, UserRole } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import type { ReportDefinition } from "./types";

/**
 * Registered Users report — admin-only roster of every user in the
 * system, with role, status, KYC state, contact info, and assigned
 * barangays for TLs.
 *
 * Restricted via requiredRoles to MGMT — TL users never see this in
 * the Reports Hub list and the route 403s if they call it directly.
 */
export const registeredUsers: ReportDefinition = {
  slug: "registered-users",
  title: "Registered Users",
  description:
    "All registered system users with role, status, KYC state, and TL barangay assignments. Admin / MHO / SHA only.",
  cadence: "annual",
  category: "admin",
  source: "users + user_barangays tables",
  requiredRoles: [UserRole.SYSTEM_ADMIN, UserRole.MHO, UserRole.SHA],
  async fetch() {
    // Pull all users + their assigned barangay names (via join).
    // userBarangays joins by userId -> barangay name resolved through
    // the barangays table; we read barangay_name via a lateral join
    // with raw SQL since the schema's userBarangays only stores ids.
    const rows = await db.execute(sql`
      SELECT
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        u.full_name,
        u.email,
        u.contact_number,
        u.role,
        u.status,
        u.kyc_face_match_status,
        u.created_at,
        COALESCE(
          (
            SELECT string_agg(b.name, ', ' ORDER BY b.name)
            FROM user_barangays ub
            JOIN barangays b ON b.id = ub.barangay_id
            WHERE ub.user_id = u.id
          ),
          ''
        ) AS assigned_barangays
      FROM users u
      ORDER BY u.role, u.username
    `);
    const list = ((rows as any).rows ?? rows ?? []) as any[];

    const fmtName = (r: any) =>
      r.full_name?.trim()
      || `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
      || r.username;

    const fmtDate = (s: any) => {
      if (!s) return "";
      try {
        const d = new Date(s);
        if (isNaN(d.getTime())) return String(s);
        return d.toISOString().slice(0, 10);
      } catch {
        return String(s);
      }
    };

    return {
      columns: [
        { key: "username", label: "Username", align: "left" },
        { key: "fullName", label: "Name", align: "left" },
        { key: "role", label: "Role", align: "left" },
        { key: "status", label: "Status", align: "left" },
        { key: "kyc", label: "KYC", align: "left" },
        { key: "email", label: "Email", align: "left" },
        { key: "contact", label: "Contact #", align: "left" },
        { key: "barangays", label: "Assigned Barangays", align: "left" },
        { key: "registered", label: "Registered", align: "left" },
      ],
      rows: list.map((r) => ({
        id: r.id,
        cells: {
          username: r.username ?? "",
          fullName: fmtName(r),
          role: r.role ?? "",
          status: r.status ?? "",
          kyc: r.kyc_face_match_status ?? "",
          email: r.email ?? "",
          contact: r.contact_number ?? "",
          barangays: r.assigned_barangays ?? "",
          registered: fmtDate(r.created_at),
        },
      })),
      meta: {
        sourceCount: list.length,
        notes: `${list.length} user${list.length === 1 ? "" : "s"} on file.`,
      },
    };
  },
};
