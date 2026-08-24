# Copyright (c) 2026, Salman Adayatt and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class SupervisorWBSAssignment(Document):
	def before_validate(doc):
	# Block overlapping supervisor assignments for same employee
		if doc.to_date and doc.to_date < doc.from_date:
			frappe.throw("To Date cannot be before From Date")

		if doc.employee and doc.from_date and doc.active:

			new_from = doc.from_date
			new_to = doc.to_date or "9999-12-31"

			conflict = frappe.db.sql("""
				SELECT name, supervisor, wbs, from_date, to_date
				FROM `tabSupervisor WBS Assignment`
				WHERE employee = %(employee)s
				AND active = 1
				AND name != %(name)s
				AND from_date <= %(new_to)s
				AND IFNULL(to_date, '9999-12-31') >= %(new_from)s
				LIMIT 1
			""", {
				"employee": doc.employee,
				"name": doc.name or "",
				"new_from": new_from,
				"new_to": new_to
			}, as_dict=True)

			if conflict:
				c = conflict[0]
				frappe.throw(
					f"Employee {doc.employee} is already assigned in this period.\n\n"
					f"Supervisor: {c['supervisor']}\n"
					f"WBS: {c['wbs']}\n"
					f"From: {c['from_date']}  To: {c['to_date'] or 'Open'}"
				)

