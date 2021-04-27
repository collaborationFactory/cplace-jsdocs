"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports._link = exports.link = exports.inlineLinks = exports.typeDefs = void 0;
const handlebars_1 = __importDefault(require("handlebars"));
const ddata_1 = __importDefault(require("dmd/helpers/ddata"));
const BuilderUtils_1 = require("../../builder/BuilderUtils");
function typeDefs(options) {
    options.hash.kind = 'typedef';
    return handlebars_1.default.helpers.each(ddata_1.default._identifiers(options), options);
}
exports.typeDefs = typeDefs;
/**
 * Overridden default
 * replaces {@link} tags with markdown links in the supplied input text
 */
function inlineLinks(text, options) {
    if (text) {
        let links = ddata_1.default.parseLink(text);
        links.forEach(function (link) {
            let linked = ddata_1.default._link(link.url, options);
            if (link.caption === link.url)
                link.caption = linked.name;
            if (linked.url)
                link.url = linked.url;
            text = text.replace(link.original, '[' + link.caption + '](' + link.url + ')');
        });
    }
    return text;
}
exports.inlineLinks = inlineLinks;
/**
 * Overridden default
 * @param id {string} - the ID to link to, e.g. `external:XMLHttpRequest`, `GlobalClass#propOne` etc.
 * @static
 * @category Block helper: util
 * @example
 * {{#link "module:someModule.property"~}}
 *   {{name}} {{!-- prints 'property' --}}
 *   {{url}}  {{!-- prints 'module-someModule-property' --}}
 * {{/link}}
 */
function link(longname, options) {
    return options.fn(_link(longname, options));
}
exports.link = link;
/**
 * Overridden default
 * e.g. namepaths `module:Something` or type expression `Array.<module:Something>`
 * @static
 * @param {string} - namepath or type expression
 * @param {object} - the handlebars helper options object
 */
function _link(input, options) {
    if (typeof input !== 'string')
        return null;
    // custom link resolver - start
    // we short circuit the resolution. if the input refers to any of our classes then we generate the link
    let resolvedLink = BuilderUtils_1.resolveDocsLinks(input, options);
    if (resolvedLink) {
        return resolvedLink;
    }
    // custom link resolver - end
    var linked, matches, namepath;
    var output = {};
    /*
    test input for
    1. A type expression containing a namepath, e.g. Array.<module:Something>
    2. a namepath referencing an `id`
    3. a namepath referencing a `longname`
    */
    if ((matches = input.match(/.*?<(.*?)>/))) {
        namepath = matches[1];
    }
    else {
        namepath = input;
    }
    options.hash = { id: namepath };
    linked = ddata_1.default._identifier(options);
    if (!linked) {
        options.hash = { longname: namepath };
        linked = ddata_1.default._identifier(options);
    }
    if (!linked) {
        output = { name: input, url: null };
    }
    else {
        output.name = input.replace(namepath, linked.name);
        if (ddata_1.default.isExternal.call(linked)) {
            if (linked.description) {
                output.url = '#' + ddata_1.default.anchorName.call(linked, options);
            }
            else {
                if (linked.see && linked.see.length) {
                    var firstLink = ddata_1.default.parseLink(linked.see[0])[0];
                    output.url = firstLink ? firstLink.url : linked.see[0];
                }
                else {
                    output.url = null;
                }
            }
        }
        else {
            output.url = '#' + ddata_1.default.anchorName.call(linked, options);
        }
    }
    return output;
}
exports._link = _link;
