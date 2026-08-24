frappe.ui.form.on('Supervisor WBS Assignment', {
  employee(frm) {
    if (!frm.doc.employee || !frm.doc.from_date) return;
    frappe.call({
      method: "frappe.client.get_list",
      args: {
        doctype: "Supervisor WBS Assignment",
        filters: {
          employee: frm.doc.employee,
          active: 1
        },
        fields: ["name", "supervisor", "wbs", "from_date", "to_date"],
        limit_page_length: 5
      },
      callback: (r) => {
        const rows = r.message || [];
        if (rows.length) {
          frappe.msgprint(
            "Existing active assignments found for this employee. Saving will be blocked if dates overlap."
          );
        }
      }
    });
  }
});
