"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDocsLinks = exports.generateLinks = exports.groupData = void 0;
const constants_1 = require("./constants");
const arrayLike = 'ArrayLike';
const entityToLink = new Map();
function groupData(templateData) {
    return templateData.reduce((groups, identifier) => {
        switch (identifier.kind) {
            case 'namespace':
                groups.namespace.add(identifier.name);
                break;
            case 'class':
                groups.clazz.add(identifier.name);
                break;
            case 'typedef':
                groups.typedef.add(identifier.name);
                break;
        }
        return groups;
    }, {
        clazz: new Set(),
        namespace: new Set(),
        typedef: new Set()
    });
}
exports.groupData = groupData;
function generateLinks(pluginShortName, groups) {
    groups.clazz.forEach(value => entityToLink.set(value, `/${constants_1.linkBase}/${pluginShortName}/s${value.toLowerCase()}`));
    groups.typedef.forEach(value => {
        entityToLink.set(value, `/${constants_1.linkBase}/${pluginShortName}/${constants_1.typeDefSlug}#${value.toLocaleLowerCase()}`);
    });
    // console.log(entityToLink.forEach((val, key) => console.log(key, val)));
}
exports.generateLinks = generateLinks;
function resolveDocsLinks(input, options) {
    let output = {};
    // special handling for ArrayLike because it is generally used as generic ArrayLike.<*> or ArrayLike.<string>
    if (input.startsWith(arrayLike) && entityToLink.has(arrayLike)) {
        output.name = input;
        output.url = entityToLink.get(arrayLike);
        return output;
    }
    // resolve for classes
    if (entityToLink.has(input)) {
        output.name = input;
        // if input refers to the class to which it belongs
        if (options.data.parent === undefined) {
            output.url = entityToLink.get(input);
        }
        else {
            output.url = '#' + input.toLowerCase();
        }
        return output;
    }
    return null;
}
exports.resolveDocsLinks = resolveDocsLinks;
