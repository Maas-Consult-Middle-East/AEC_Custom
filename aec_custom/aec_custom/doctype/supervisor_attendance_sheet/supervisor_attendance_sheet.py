# Copyright (c) 2026, Salman Adayatt and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, get_datetime, get_datetime_str, nowdate


class SupervisorAttendanceSheet(Document):
    pass


# ============================================================
# GET SUPERVISOR TEAM
# ============================================================

@frappe.whitelist()
def get_supervisor_team(supervisor=None, sheet_date=None):
    """
    Return unique employees assigned to the supervisor
    and active on the selected date.
    """

    if not supervisor or not sheet_date:
        return []

    sheet_date = getdate(sheet_date)

    return frappe.db.sql(
        """
        SELECT DISTINCT employee
        FROM `tabSupervisor WBS Assignment`
        WHERE supervisor = %(supervisor)s
            AND active = 1
            AND from_date <= %(sheet_date)s
            AND (
                to_date IS NULL
                OR to_date = ''
                OR to_date >= %(sheet_date)s
            )
        ORDER BY employee ASC
        """,
        {
            "supervisor": supervisor,
            "sheet_date": sheet_date
        },
        pluck="employee"
    )


# ============================================================
# POST SUPERVISOR ATTENDANCE
# ============================================================

@frappe.whitelist()
def post_supervisor_attendance(sheet_name):
    """
    Create Employee Checkin records from
    Supervisor Attendance Sheet.
    """

    if not sheet_name:
        frappe.throw(_("sheet_name is required"))

    sheet = frappe.get_doc(
        "Supervisor Attendance Sheet",
        sheet_name
    )

    # Prevent duplicate posting
    if sheet.status == "Posted":
        return {
            "ok": True,
            "posted_rows": 0,
            "skipped_rows": 0,
            "error_rows": 0,
            "msg": _("Already posted")
        }

    posted = 0
    skipped = 0
    errors = 0

    sheet_date = sheet.sheet_date

    for row in sheet.employee:

        result = process_attendance_row(
            row,
            sheet_date
        )

        if result == "posted":
            posted += 1

        elif result == "skipped":
            skipped += 1

        else:
            errors += 1

    # --------------------------------------------------------
    # UPDATE SHEET STATUS
    # --------------------------------------------------------

    update_sheet_status(
        sheet,
        posted
    )

    frappe.db.commit()

    return {
        "ok": True,
        "posted_rows": posted,
        "skipped_rows": skipped,
        "error_rows": errors
    }


# ============================================================
# PROCESS SINGLE ATTENDANCE ROW
# ============================================================

def process_attendance_row(row, sheet_date):
    """
    Process one employee attendance row.
    Returns:
        posted
        skipped
        error
    """

    employee = row.employee

    check_in = build_datetime(
        row.check_in,
        row.check_in_time,
        sheet_date
    )

    check_out = build_datetime(
        row.check_out,
        row.check_out_time,
        sheet_date
    )

    # --------------------------------------------------------
    # REQUIRED FIELDS
    # --------------------------------------------------------

    if not employee or not check_in:

        update_row_status(
            row,
            status="Not Posted",
            error_message=_("Missing Employee or Check In Time")
        )

        return "skipped"

    try:

        check_in_datetime = get_datetime(check_in)

        check_out_datetime = (
            get_datetime(check_out)
            if check_out
            else None
        )

        # ----------------------------------------------------
        # VALIDATE TIME
        # ----------------------------------------------------

        if (
            check_out_datetime
            and check_out_datetime <= check_in_datetime
        ):

            update_row_status(
                row,
                status="Error",
                error_message=_(
                    "Check Out must be after Check In"
                )
            )

            return "error"

        # ----------------------------------------------------
        # SAVE FINAL DATETIME VALUES
        # ----------------------------------------------------

        check_in = get_datetime_str(
            check_in_datetime
        )

        check_out = (
            get_datetime_str(check_out_datetime)
            if check_out_datetime
            else None
        )

        frappe.db.set_value(
            row.doctype,
            row.name,
            "check_in",
            check_in
        )

        if check_out:
            frappe.db.set_value(
                row.doctype,
                row.name,
                "check_out",
                check_out
            )

        # ----------------------------------------------------
        # CREATE CHECK-IN
        # ----------------------------------------------------

        in_ref = row.in_checkin_ref

        if not in_ref:

            in_ref = create_employee_checkin(
                employee=employee,
                attendance_time=check_in,
                log_type="IN"
            )

        # ----------------------------------------------------
        # CREATE CHECK-OUT
        # ----------------------------------------------------

        out_ref = row.out_checkin_ref

        if check_out and not out_ref:

            out_ref = create_employee_checkin(
                employee=employee,
                attendance_time=check_out,
                log_type="OUT"
            )

        # ----------------------------------------------------
        # UPDATE ROW
        # ----------------------------------------------------

        frappe.db.set_value(
            row.doctype,
            row.name,
            {
                "in_checkin_ref": in_ref,
                "out_checkin_ref": out_ref,
                "post_status": "Posted",
                "error_message": ""
            }
        )

        return "posted"

    except Exception as error:

        frappe.log_error(
            frappe.get_traceback(),
            "Supervisor Attendance Posting Error"
        )

        update_row_status(
            row,
            status="Error",
            error_message=str(error)
        )

        return "error"


# ============================================================
# BUILD DATETIME
# ============================================================

def build_datetime(datetime_value, time_value, sheet_date):
    """
    Return existing datetime or build one from
    Sheet Date + Time.
    """

    if datetime_value:
        return datetime_value

    if time_value and sheet_date:
        return f"{sheet_date} {time_value}"

    return None


# ============================================================
# CREATE EMPLOYEE CHECKIN
# ============================================================

def create_employee_checkin(
    employee,
    attendance_time,
    log_type
):

    checkin = frappe.get_doc({
        "doctype": "Employee Checkin",
        "employee": employee,
        "time": attendance_time,
        "log_type": log_type
    })

    checkin.insert(
        ignore_permissions=True
    )

    return checkin.name


# ============================================================
# UPDATE CHILD ROW STATUS
# ============================================================

def update_row_status(
    row,
    status,
    error_message=""
):

    frappe.db.set_value(
        row.doctype,
        row.name,
        {
            "post_status": status,
            "error_message": error_message
        }
    )


# ============================================================
# UPDATE SHEET STATUS
# ============================================================

def update_sheet_status(sheet, posted):

    if posted > 0:

        frappe.db.set_value(
            "Supervisor Attendance Sheet",
            sheet.name,
            {
                "status": "Posted",
                "posted_on": nowdate(),
                "posted_by": frappe.session.user
            }
        )

    else:

        frappe.db.set_value(
            "Supervisor Attendance Sheet",
            sheet.name,
            "status",
            "Draft"
        )

def before_save(doc, method):
	for row in doc.employee:
		if row.check_in and row.check_out:
			start = frappe.utils.get_datetime(row.check_in)
			end = frappe.utils.get_datetime(row.check_out)

			diff_seconds = (end - start).total_seconds()

			if diff_seconds <= 0:
				frappe.throw(f"Row {row.idx}: Check-Out must be after Check-In")

			row.hours = round(diff_seconds / 3600, 2)
		else:
			row.hours = 0
