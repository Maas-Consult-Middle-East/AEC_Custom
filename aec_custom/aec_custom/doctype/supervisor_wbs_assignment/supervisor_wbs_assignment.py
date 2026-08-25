import frappe
from frappe.model.document import Document


class SupervisorWBSAssignment(Document):

	def before_validate(self):

		
		if self.to_date and self.to_date < self.from_date:
			frappe.throw("To Date cannot be before From Date")

		
		if self.employee and self.from_date and self.active:

			new_from = self.from_date
			new_to = self.to_date or "9999-12-31"

			conflict = frappe.db.sql("""
				SELECT
					name,
					supervisor,
					from_date,
					to_date
				FROM `tabSupervisor WBS Assignment`
				WHERE employee = %(employee)s
					AND active = 1
					AND name != %(name)s
					AND from_date <= %(new_to)s
					AND IFNULL(to_date, '9999-12-31') >= %(new_from)s
				LIMIT 1
			""", {
				"employee": self.employee,
				"name": self.name or "",
				"new_from": new_from,
				"new_to": new_to
			}, as_dict=True)

			if conflict:
				c = conflict[0]

				frappe.throw(
					f"Employee {self.employee} is already assigned during this period.<br><br>"
					f"<b>Supervisor:</b> {c['supervisor']}<br>"
					f"<b>From:</b> {c['from_date']}<br>"
					f"<b>To:</b> {c['to_date'] or 'Open'}"
				)