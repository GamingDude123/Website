/* The colleges this copy of the extension already knows, so a line in the list can be just a
 * name. Each is { name, aliases: [other names], url: the application portal, colors: [primary,
 * secondary?] }. The public download ships none: it is filled in for a particular person by
 * `python3 pack.py --personal`. */
var COLLEGES = [];
