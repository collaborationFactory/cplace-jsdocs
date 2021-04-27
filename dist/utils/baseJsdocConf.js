"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const baseConf = {
    'tags': {
        'allowUnknownTags': true,
        'dictionaries': [
            'jsdoc'
        ]
    },
    'plugins': [
        'plugins/markdown'
    ],
    'opts': {
        'encoding': 'utf8',
        'private': true,
        'recurse': true,
        'docsDir': '__TO_BE_REPLACED__',
        'cplacePlugin': '__TO_BE_REPLACED__'
    }
};
exports.default = baseConf;
