frappe.ui.form.on('WBS', {
    refresh(frm) {
        toggle_naming_series_field(frm);
        show_placement_path(frm);
        add_transfer_budget_button(frm);
    },

    parent_wbs(frm) {
        toggle_naming_series_field(frm);

        if (!frm.doc.parent_wbs) {
            frm.set_value('naming_series', '');
            frm.set_intro('');
            return;
        }

        generate_child_wbs_number(frm);
        show_placement_path(frm);
    },

    validate(frm) {
        validate_budget_release(frm);
    }
});


/* ============================================================
   NAMING SERIES
============================================================ */

function toggle_naming_series_field(frm) {
    frm.set_df_property(
        'naming_series',
        'read_only',
        frm.doc.parent_wbs ? 1 : 0
    );
}


async function generate_child_wbs_number(frm) {
    try {
        // Get parent naming series
        const parent = await frappe.db.get_value(
            'WBS',
            frm.doc.parent_wbs,
            'naming_series'
        );

        if (!parent.message?.naming_series) {
            return;
        }

        const parent_number = parent.message.naming_series;

        // Get sibling WBS records
        const siblings = await frappe.db.get_list('WBS', {
            filters: {
                parent_wbs: frm.doc.parent_wbs
            },
            fields: ['naming_series'],
            limit_page_length: 1000
        });

        // Extract child numbers
        const child_numbers = siblings
            .map(row => {
                const parts = row.naming_series?.split('-');
                return parseInt(parts?.[parts.length - 1]);
            })
            .filter(number => !isNaN(number));

        const next_number = child_numbers.length
            ? Math.max(...child_numbers) + 1
            : 1;

        const padded_number = String(next_number).padStart(2, '0');

        frm.set_value(
            'naming_series',
            `${parent_number}-${padded_number}`
        );

    } catch (error) {
        console.error('Error generating WBS number:', error);
    }
}


/* ============================================================
   WBS PLACEMENT PATH
============================================================ */

async function show_placement_path(frm) {
    if (!frm.doc.parent_wbs) {
        frm.set_intro('');
        return;
    }

    try {
        const wbs_list = await frappe.db.get_list('WBS', {
            fields: [
                'name',
                'wbs_name',
                'parent_wbs'
            ],
            limit_page_length: 1000
        });

        const map = {};

        wbs_list.forEach(row => {
            map[row.name] = row;
        });

        const chain = [];
        let current = frm.doc.parent_wbs;

        while (current && map[current]) {
            const wbs = map[current];

            chain.unshift(
                `${wbs.name} - ${wbs.wbs_name}`
            );

            current = wbs.parent_wbs;
        }

        frm.set_intro(
            `Placement Path: <b>${chain.join(' › ')}</b>`,
            'blue'
        );

    } catch (error) {
        console.error('Error loading WBS path:', error);
    }
}


/* ============================================================
   TRANSFER BUDGET BUTTON
============================================================ */

function add_transfer_budget_button(frm) {
    if (frm.is_new()) {
        return;
    }

    frm.add_custom_button(
        __('Transfer Budget'),
        () => open_budget_transfer_dialog(frm)
    );
}


function open_budget_transfer_dialog(frm) {

    // Check role before opening dialog
    if (!frappe.user_roles.includes('System Manager')) {
        frappe.msgprint({
            title: __('Permission Denied'),
            message: __('You do not have permission to transfer budgets.'),
            indicator: 'red'
        });

        return;
    }

    frappe.prompt(
        [
            {
                fieldname: 'to_wbs',
                label: 'To WBS',
                fieldtype: 'Link',
                options: 'WBS',
                reqd: 1,
                get_query: () => ({
                    filters: {
                        is_group: 0,
                        name: ['!=', frm.doc.name]
                    }
                })
            },
            {
                fieldname: 'amount',
                label: 'Amount',
                fieldtype: 'Currency',
                reqd: 1
            },
            {
                fieldname: 'remarks',
                label: 'Remarks',
                fieldtype: 'Small Text'
            }
        ],

        async (values) => {
            await transfer_budget(frm, values);
        },

        __('Transfer Budget'),
        __('Transfer')
    );
}


/* ============================================================
   BUDGET TRANSFER
============================================================ */

async function transfer_budget(frm, values) {

    try {

        const amount = Number(values.amount || 0);

        if (amount <= 0) {
            frappe.msgprint({
                title: __('Invalid Amount'),
                message: __('Transfer amount must be greater than zero.'),
                indicator: 'red'
            });

            return;
        }


        // Get FROM WBS
        const from_response = await frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'WBS',
                name: frm.doc.name
            }
        });

        const from_doc = from_response.message;

        if (!from_doc) {
            return;
        }

        const from_budget = Number(from_doc.budget || 0);

        if (from_budget < amount) {
            frappe.msgprint({
                title: __('Insufficient Budget'),
                message: __(
                    'Available Budget is {0}, but you are trying to transfer {1}.',
                    [
                        from_budget,
                        amount
                    ]
                ),
                indicator: 'red'
            });

            return;
        }


        // Get TO WBS
        const to_response = await frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'WBS',
                name: values.to_wbs
            }
        });

        const to_doc = to_response.message;

        if (!to_doc) {
            frappe.throw(__('Destination WBS not found.'));
        }


        // Update FROM WBS
        from_doc.budget = from_budget - amount;

        from_doc.budget_transfer_history =
            from_doc.budget_transfer_history || [];

        from_doc.budget_transfer_history.push({
            date: frappe.datetime.get_today(),
            from_wbs: frm.doc.name,
            to_wbs: values.to_wbs,
            amount: amount,
            remarks: values.remarks,
            transferred_by: frappe.session.user,
            direction: 'Outgoing'
        });


        // Update TO WBS
        to_doc.budget =
            Number(to_doc.budget || 0) + amount;

        to_doc.budget_transfer_history =
            to_doc.budget_transfer_history || [];

        to_doc.budget_transfer_history.push({
            date: frappe.datetime.get_today(),
            from_wbs: frm.doc.name,
            to_wbs: values.to_wbs,
            amount: amount,
            remarks: values.remarks,
            transferred_by: frappe.session.user,
            direction: 'Incoming'
        });


        // Save FROM WBS
        await frappe.call({
            method: 'frappe.client.save',
            args: {
                doc: from_doc
            }
        });


        // Save TO WBS
        await frappe.call({
            method: 'frappe.client.save',
            args: {
                doc: to_doc
            }
        });


        frappe.show_alert({
            message: __('Budget transferred successfully'),
            indicator: 'green'
        });


        await frm.reload_doc();

    } catch (error) {

        console.error('Budget transfer error:', error);

        frappe.msgprint({
            title: __('Error'),
            message: __('Unable to complete the budget transfer.'),
            indicator: 'red'
        });
    }
}


/* ============================================================
   VALIDATE BUDGET AND RELEASE
============================================================ */

function validate_budget_release(frm) {

    const budget = Number(frm.doc.budget || 0);
    const release = Number(frm.doc.release || 0);

    if (release > budget) {

        frappe.msgprint({
            title: __('Heads up'),
            message: __(
                'Release ({0}) cannot be greater than Budget ({1}).',
                [release, budget]
            ),
            indicator: 'red'
        });

        frappe.validated = false;
    }
}