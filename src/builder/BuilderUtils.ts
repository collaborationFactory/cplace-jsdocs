import {linkBase, typeDefSlug} from './constants';

export interface IEntityGroups {
    clazz: Set<string>;
    namespace: Set<string>;
    typedef: Set<string>;
}

const arrayLike = 'ArrayLike';
const entityToLink = new Map<string, string>();

export function groupData(templateData: Array<any>): IEntityGroups {
    return templateData.reduce((groups: IEntityGroups, identifier) => {
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
        clazz: new Set<string>(),
        namespace: new Set<string>(),
        typedef: new Set<string>()
    });
}

export function generateLinks(pluginShortName: string, groups: IEntityGroups) {
    groups.clazz.forEach(value => entityToLink.set(value, `/${linkBase}/api/${pluginShortName}/s${value.toLowerCase()}`));
    groups.typedef.forEach(value => {
        entityToLink.set(value, `/${linkBase}/api/${pluginShortName}/${typeDefSlug}#${value.toLocaleLowerCase()}`);
    });
    // console.log(entityToLink.forEach((val, key) => console.log(key, val)));
}

export function resolveDocsLinks(input, options): any {

    let output = {} as any;
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
        } else {
            output.url = '#' + input.toLowerCase()
        }

        return output;
    }
    return null;

}
