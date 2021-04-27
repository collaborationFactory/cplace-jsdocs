import handlebars from 'handlebars';
import ddata from 'dmd/helpers/ddata';
import {resolveDocsLinks} from '../../builder/BuilderUtils';


export function typeDefs(options) {
    options.hash.kind = 'typedef';
    return handlebars.helpers.each(ddata._identifiers(options), options);
}

/**
 * Overridden default
 * replaces {@link} tags with markdown links in the supplied input text
 */
export function inlineLinks(text, options) {
    if (text) {
        let links = ddata.parseLink(text);
        links.forEach(function (link) {
            let linked = ddata._link(link.url, options);
            if (link.caption === link.url) link.caption = linked.name;
            if (linked.url) link.url = linked.url;
            text = text.replace(link.original, '[' + link.caption + '](' + link.url + ')');
        })
    }

    return text;
}

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
export function link(longname, options) {
    return options.fn(_link(longname, options))
}

/**
 * Overridden default
 * e.g. namepaths `module:Something` or type expression `Array.<module:Something>`
 * @static
 * @param {string} - namepath or type expression
 * @param {object} - the handlebars helper options object
 */
export function _link(input, options) {
    if (typeof input !== 'string') return null;

    // custom link resolver - start
    // we short circuit the resolution. if the input refers to any of our classes then we generate the link
    let resolvedLink = resolveDocsLinks(input, options);
    if (resolvedLink) {
        return resolvedLink;
    }
    // custom link resolver - end

    var linked, matches, namepath;
    var output = {} as any;

    /*
    test input for
    1. A type expression containing a namepath, e.g. Array.<module:Something>
    2. a namepath referencing an `id`
    3. a namepath referencing a `longname`
    */
    if ((matches = input.match(/.*?<(.*?)>/))) {
        namepath = matches[1]
    } else {
        namepath = input
    }

    options.hash = {id: namepath};
    linked = ddata._identifier(options);
    if (!linked) {
        options.hash = {longname: namepath};
        linked = ddata._identifier(options)
    }
    if (!linked) {
        output = {name: input, url: null}
    } else {
        output.name = input.replace(namepath, linked.name);
        if (ddata.isExternal.call(linked)) {
            if (linked.description) {
                output.url = '#' + ddata.anchorName.call(linked, options)
            } else {
                if (linked.see && linked.see.length) {
                    var firstLink = ddata.parseLink(linked.see[0])[0];
                    output.url = firstLink ? firstLink.url : linked.see[0]
                } else {
                    output.url = null
                }
            }
        } else {
            output.url = '#' + ddata.anchorName.call(linked, options)
        }
    }

    return output


}