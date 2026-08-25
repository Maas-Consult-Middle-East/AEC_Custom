frappe.ui.form.on('Supervisor Attendance Sheet', {
    refresh(frm) {
    if (!frm.is_new() && frm.doc.status !== "Posted") {
        frm.add_custom_button(__('Load Team'), () => load_team(frm));
        frm.add_custom_button(__('Bulk Attendance'), () => bulk_attendance(frm));
        frm.add_custom_button(__('Bulk WBS'), function() {
    bulk_wbs(frm);
});
        frm.add_custom_button(__('Post Attendance'), () => post_attendance(frm));
    }
},

    supervisor(frm) {
        clear_team(frm);
    },

    wbs(frm) {
        clear_team(frm);
    },

    sheet_date(frm) {
        rebuild_all_datetimes(frm);
    }
});

// Child table: time-only -> datetime build
frappe.ui.form.on('Supervisor Attendance Line', {
    check_in_time(frm, cdt, cdn) {
        set_datetime_from_sheet(frm, cdt, cdn, 'check_in_time', 'check_in');
        warn_row_if_invalid(frm, cdt, cdn);
    },

    check_out_time(frm, cdt, cdn) {
        set_datetime_from_sheet(frm, cdt, cdn, 'check_out_time', 'check_out');
        warn_row_if_invalid(frm, cdt, cdn);
    }
});

function clear_team(frm) {
    frm.clear_table('employee');
    frm.refresh_field('employee');
}

function load_team(frm) {
    if (!frm.doc.supervisor || !frm.doc.sheet_date) {
    frappe.msgprint(__('Please select Supervisor and Sheet Date first.'));
    return;
}

    frappe.call({
        method: "aec_custom.aec_custom.doctype.supervisor_attendance_sheet.supervisor_attendance_sheet.get_supervisor_team",
        args: {
            supervisor: frm.doc.supervisor,
            sheet_date: frm.doc.sheet_date
        },
        callback: function (r) {
            const employees = r.message || [];

            frm.clear_table('employee');

            if (!employees.length) {
                frappe.msgprint(__('No employees found for this Supervisor + WBS on the selected date.'));
            }

            employees.forEach(emp => {
                const row = frm.add_child('employee');
                row.employee = emp;

                row.post_status = "Not Posted";
                row.in_checkin_ref = "";
                row.out_checkin_ref = "";
                row.error_message = "";

                row.check_in_time = "";
                row.check_out_time = "";
                row.check_in = "";
                row.check_out = "";
                row.hours = 0;
            });

            frm.refresh_field('employee');
        }
    });
}

/**
 * One button: asks Check In / Check Out then calls bulk_time()
 */
function bulk_attendance(frm) {
    frappe.prompt(
        [
            {
                fieldname: "mode",
                label: "Attendance Type",
                fieldtype: "Select",
                options: "Check In\nCheck Out",
                reqd: 1
            }
        ],
        (values) => {
            if (values.mode === "Check In") {
                bulk_time(frm, 'check_in_time', 'check_in');
            } else {
                bulk_time(frm, 'check_out_time', 'check_out');
            }
        },
        __('Bulk Attendance'),
        __('Next')
    );
}

// Bulk set time for all rows (FIXED to save properly)
function bulk_time(frm, time_field, datetime_field) {
    if (!frm.doc.sheet_date) {
        frappe.msgprint(__('Please select Sheet Date first.'));
        return;
    }

    if (!frm.doc.employee || !frm.doc.employee.length) {
        frappe.msgprint(__('No employees in the table. Click Load Team first.'));
        return;
    }

    frappe.prompt(
        [
            { fieldname: "t", label: "Time (HH:mm or HH:mm:ss)", fieldtype: "Data", reqd: 1 },
            { fieldname: "only_empty", label: "Apply only to empty rows", fieldtype: "Check", default: 1 }
        ],
        (values) => {
            const input_time = (values.t || "").trim();
            const only_empty = values.only_empty ? 1 : 0;

            if (!is_valid_time(input_time)) {
                frappe.msgprint(__('Invalid time. Use HH:mm or HH:mm:ss (example: 09:00 or 09:00:00).'));
                return;
            }

            const normalized_time = normalize_time(input_time);
            let updated = 0;

            (frm.doc.employee || []).forEach(row => {
                if (!row.employee) return;
                if (only_empty && row[time_field]) return;

                // ✅ MUST use set_value so it persists after reload
                frappe.model.set_value(row.doctype, row.name, time_field, normalized_time);
                frappe.model.set_value(row.doctype, row.name, datetime_field, `${frm.doc.sheet_date} ${normalized_time}`);

                updated = updated + 1;
            });

            // ✅ ensure doc is marked dirty
            frm.dirty();

            warn_if_same_or_before(frm);

            frappe.msgprint(
                __('Updated {0} rows for {1} with time: {2}', [updated, time_field, normalized_time])
            );
        },
        __('Bulk Set Time'),
        __('Apply')
    );
}

// Build datetime using sheet_date + row time (FIXED)
function set_datetime_from_sheet(frm, cdt, cdn, time_field, datetime_field) {
    const row = locals[cdt][cdn];

    if (!frm.doc.sheet_date) {
        frappe.msgprint(__('Please select Sheet Date first.'));
        frappe.model.set_value(cdt, cdn, time_field, "");
        frappe.model.set_value(cdt, cdn, datetime_field, "");
        return;
    }

    if (!row[time_field]) {
        frappe.model.set_value(cdt, cdn, datetime_field, "");
        return;
    }

    const t = String(row[time_field]).trim();

    if (!is_valid_time(t)) {
        frappe.msgprint(__('Invalid time. Use HH:mm or HH:mm:ss (example: 09:00 or 09:00:00).'));
        frappe.model.set_value(cdt, cdn, time_field, "");
        frappe.model.set_value(cdt, cdn, datetime_field, "");
        return;
    }

    const normalized_time = normalize_time(t);

    // ✅ MUST use set_value
    frappe.model.set_value(cdt, cdn, time_field, normalized_time);
    frappe.model.set_value(cdt, cdn, datetime_field, `${frm.doc.sheet_date} ${normalized_time}`);

    frm.dirty();
}

function rebuild_all_datetimes(frm) {
    if (!frm.doc.sheet_date || !frm.doc.employee) return;

    (frm.doc.employee || []).forEach(row => {
        if (row.check_in_time && is_valid_time(row.check_in_time)) {
            const t = normalize_time(String(row.check_in_time).trim());
            frappe.model.set_value(row.doctype, row.name, "check_in_time", t);
            frappe.model.set_value(row.doctype, row.name, "check_in", `${frm.doc.sheet_date} ${t}`);
        } else {
            frappe.model.set_value(row.doctype, row.name, "check_in", "");
        }

        if (row.check_out_time && is_valid_time(row.check_out_time)) {
            const t = normalize_time(String(row.check_out_time).trim());
            frappe.model.set_value(row.doctype, row.name, "check_out_time", t);
            frappe.model.set_value(row.doctype, row.name, "check_out", `${frm.doc.sheet_date} ${t}`);
        } else {
            frappe.model.set_value(row.doctype, row.name, "check_out", "");
        }
    });

    frm.dirty();
    warn_if_same_or_before(frm);
}

function warn_row_if_invalid(frm, cdt, cdn) {
    const row = locals[cdt][cdn];

    if (row.check_in_time && row.check_out_time) {
        const in_t = normalize_time(String(row.check_in_time).trim());
        const out_t = normalize_time(String(row.check_out_time).trim());

        if (out_t <= in_t) {
            frappe.show_alert({
                message: __('Check Out Time must be after Check In Time (Row {0})', [row.idx]),
                indicator: 'orange'
            });
        }
    }
}

function warn_if_same_or_before(frm) {
    let issues = 0;

    (frm.doc.employee || []).forEach(row => {
        if (row.check_in_time && row.check_out_time) {
            const in_t = normalize_time(String(row.check_in_time).trim());
            const out_t = normalize_time(String(row.check_out_time).trim());
            if (out_t <= in_t) issues = issues + 1;
        }
    });

    if (issues) {
        frappe.msgprint(__('Warning: {0} row(s) have Check Out Time same/before Check In Time.', [issues]));
    }
}

// Helpers
function normalize_time(t) {
    if (t.length === 5) return `${t}:00`;
    return t;
}

function is_valid_time(t) {
    return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(t);
}

// POST: ALWAYS save first (FIXED for bulk)
function post_attendance(frm) {
    if (frm.doc.status === "Posted") {
        frappe.msgprint(__('Attendance already posted.'));
        return;
    }

    const has_any_checkin = (frm.doc.employee || []).some(r => r.employee && (r.check_in_time || r.check_in));
    if (!has_any_checkin) {
        frappe.msgprint(__('Please enter at least one Check In Time before posting.'));
        return;
    }

    // close any open row editor (grid)
    try {
        frm.fields_dict.employee.grid.grid_rows.forEach(gr => gr.toggle_view(false));
    } catch (e) {}

    frappe.confirm(__('Post attendance to Employee Checkin?'), () => {
        // ✅ ALWAYS save first so bulk values persist
        frm.dirty();
        frm.save().then(() => {
            frappe.call({
				method: "aec_custom.aec_custom.doctype.supervisor_attendance_sheet.supervisor_attendance_sheet.post_supervisor_attendance",
				args: {
					sheet_name: frm.doc.name
				},
				callback(r) {
					const res = r.message || {};

					frappe.msgprint(
						`Posted Rows: ${res.posted_rows || 0}<br>` +
						`Skipped Rows: ${res.skipped_rows || 0}<br>` +
						`Error Rows: ${res.error_rows || 0}`
					);

					frm.reload_doc();
				}
			});
        }).catch(() => {
            frappe.msgprint(__('Save failed. Please try again.'));
        });
    });
}
function bulk_wbs(frm) {
    if (!frm.doc.employee || !frm.doc.employee.length) {
        frappe.msgprint(__('No employees found.'));
        return;
    }

    frappe.prompt(
        [
            {
                fieldname: "wbs",
                label: "Select WBS",
                fieldtype: "Link",
                options: "WBS",
                reqd: 1
            }
        ],
        function(values) {
            let updated = 0;

            $.each(frm.doc.employee, function(i, d) {
                d.wbs = values.wbs;
                updated++;
            });

            frm.fields_dict.employee.grid.refresh();
            frm.refresh_field("employee");
            frm.dirty();

            frappe.msgprint(__('WBS applied to ' + updated + ' row(s).'));
        },
        __('Bulk WBS'),
        __('Apply')
    );
}

