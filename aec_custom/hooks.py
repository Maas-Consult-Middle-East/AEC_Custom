app_name = "aec_custom"
app_title = "Aec Custom"
app_publisher = "Salman Adayatt"
app_description = "Custom Frappe app for AEC"
app_email = "frappe@maasconsult.co"
app_license = "MIT"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/aec_custom/css/aec_custom.css"
# app_include_js = "/assets/aec_custom/js/aec_custom.js"

# include js, css files in header of web template
# web_include_css = "/assets/aec_custom/css/aec_custom.css"
# web_include_js = "/assets/aec_custom/js/aec_custom.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "aec_custom/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
                "Purchase Order": "public/js/purchase_order.js",
                "Supplier Quotation": "public/js/supplier_quotation.js",
              }
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "aec_custom.utils.jinja_methods",
# 	"filters": "aec_custom.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "aec_custom.install.before_install"
# after_install = "aec_custom.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "aec_custom.uninstall.before_uninstall"
# after_uninstall = "aec_custom.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "aec_custom.utils.before_app_install"
# after_app_install = "aec_custom.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "aec_custom.utils.before_app_uninstall"
# after_app_uninstall = "aec_custom.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "aec_custom.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"Item": {
		"before_save": "aec_custom.events.item.set_item_name",
	},
    "Supplier Quotation": {
        "on_submit": "aec_custom.events.supplier_quotation.update_supplier_quotation_items",
    }
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"aec_custom.tasks.all"
# 	],
# 	"daily": [
# 		"aec_custom.tasks.daily"
# 	],
# 	"hourly": [
# 		"aec_custom.tasks.hourly"
# 	],
# 	"weekly": [
# 		"aec_custom.tasks.weekly"
# 	],
# 	"monthly": [
# 		"aec_custom.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "aec_custom.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "aec_custom.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "aec_custom.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["aec_custom.utils.before_request"]
# after_request = ["aec_custom.utils.after_request"]

# Job Events
# ----------
# before_job = ["aec_custom.utils.before_job"]
# after_job = ["aec_custom.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"aec_custom.auth.validate"
# ]

fixtures = [
    {
        "dt": "Custom Field",
        "filters": [
            ["module", "=", "aec_custom"]
        ]
    },
    {
        "dt": "Property Setter",
        "filters": [
            ["module", "=", "aec_custom"]
        ]
    }
]