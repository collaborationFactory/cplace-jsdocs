"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// create temporary working directory
const os = __importStar(require("os"));
const utils_1 = require("../utils");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const fs_1 = require("fs");
const rimraf = __importStar(require("rimraf"));
const fs_extra_1 = require("fs-extra");
const jsdoc_to_markdown_1 = __importDefault(require("jsdoc-to-markdown"));
const tmpl_class_1 = __importDefault(require("../dmd-ext/templates/tmpl-class"));
const tmpl_namespace_1 = __importDefault(require("../dmd-ext/templates/tmpl-namespace"));
const tmpl_typedef_1 = __importDefault(require("../dmd-ext/templates/tmpl-typedef"));
const tmpl_fromtMatter_1 = __importDefault(require("../dmd-ext/templates/tmpl-fromtMatter"));
const BuilderUtils_1 = require("./BuilderUtils");
require("../dmd-ext/helper/helpers");
class DocsBuilder {
    constructor(plugins, destination) {
        this.plugins = plugins;
        this.destination = destination;
        this.workingDir = DocsBuilder.createTemporaryWorkingDir();
        if (!this.destination) {
            this.destination = path.join(this.workingDir, 'out');
        }
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            fs_extra_1.ensureDirSync(this.destination);
            console.log('Collecting docs from plugins...');
            this.copyDocsFromPlugins();
            const docsSource = this.getAllDocsPaths();
            Object.keys(docsSource).forEach((plugin) => {
                const pathsForJsdoc = {
                    cplacePlugin: plugin,
                    sourceDir: docsSource[plugin],
                    jsdocPlugin: require.resolve('../lib/cplaceJsdocPlugin'),
                };
                this.buildForPlugin(plugin, pathsForJsdoc);
            });
        });
    }
    buildForPlugin(plugin, jsdocPaths) {
        // if plugin does not contain any js files return
        if (!DocsBuilder.containsJsFiles(path.join(jsdocPaths.sourceDir, 'docs'))) {
            return;
        }
        let metaData = DocsBuilder.getMetaData(jsdocPaths.sourceDir, plugin);
        if (!metaData.displayName) {
            console.error(`(CplaceJSDocs) Incorrect meta data cannot build docs for ${plugin}`);
            return;
        }
        const outputPath = path.join(this.destination, plugin.replace(/\W+/gi, '-').toLowerCase());
        fs_extra_1.mkdirpSync(outputPath);
        const pluginFm = tmpl_fromtMatter_1.default(metaData.displayName);
        fs_extra_1.outputFileSync(path.join(outputPath, '_index.md'), pluginFm);
        let docsData = jsdoc_to_markdown_1.default.getTemplateDataSync({
            'no-cache': true,
            files: path.join(jsdocPaths.sourceDir, 'docs', '/**/*.js'),
        });
        // group different types of entities
        const groups = BuilderUtils_1.groupData(docsData);
        BuilderUtils_1.generateLinks(plugin, groups);
        Object.keys(groups).forEach((group) => {
            // typedefs are handled later
            if (group === 'typedef') {
                return;
            }
            const templateClosure = DocsBuilder.getTemplateClosure(group);
            for (const entry of groups[group]) {
                const template = templateClosure(entry);
                utils_1.debug(`rendering ${entry}`);
                const output = jsdoc_to_markdown_1.default.renderSync({
                    data: docsData,
                    template: template,
                    helper: require.resolve('../dmd-ext/helper/helpers'),
                });
                const filePath = path.resolve(outputPath, `${entry.toLowerCase()}.md`);
                fs.writeFileSync(filePath, output);
                utils_1.debug(`Written file:  ${filePath}`);
            }
        });
        // do it for global typedefs
        if (groups.typedef.size) {
            const templateClosure = DocsBuilder.getTemplateClosure('typedef');
            const template = templateClosure('Helper types');
            const output = jsdoc_to_markdown_1.default.renderSync({
                data: docsData,
                helper: require.resolve('../dmd-ext/helper/helpers'),
                template: template,
            });
            fs.writeFileSync(path.resolve(outputPath, 'helper-types.md'), output);
        }
        console.log('Docs generated in folder: ' + outputPath);
    }
    copyDocsFromPlugins() {
        this.plugins.forEach((pluginPath, pluginName) => {
            fs_extra_1.copySync(path.join(pluginPath, 'assets', 'cplaceJS'), path.join(this.workingDir, DocsBuilder.allDocsDir, pluginName));
        });
    }
    static containsJsFiles(dir) {
        if (!fs_1.existsSync(dir)) {
            return false;
        }
        const files = fs.readdirSync(dir);
        for (let i = 0; i < files.length; i++) {
            const filename = path.join(dir, files[i]);
            const stat = fs.lstatSync(filename);
            if (stat.isDirectory()) {
                if (this.containsJsFiles(filename)) {
                    return true;
                }
            }
            else if (filename.indexOf('.js') >= 0) {
                return true;
            }
        }
        return false;
    }
    getAllDocsPaths() {
        const docsPaths = {};
        for (const pluginName of this.plugins.keys()) {
            docsPaths[pluginName] = path.join(this.workingDir, 'allDocs', pluginName);
        }
        return docsPaths;
    }
    static getMetaData(dir, plugin) {
        const file = path.resolve(dir, 'manifest.json');
        let data;
        if (fs.existsSync(file)) {
            data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        }
        if (!data || !data.displayName) {
            const shortName = plugin.split('.').pop();
            data = {
                pluginShortName: shortName,
                displayName: shortName,
            };
        }
        return data;
    }
    static getTemplateClosure(type) {
        switch (type) {
            case 'clazz':
                return tmpl_class_1.default;
            case 'namespace':
                return tmpl_namespace_1.default;
            case 'typedef':
                return tmpl_typedef_1.default;
            default:
                return () => {
                    return '{{>docs}}';
                };
        }
    }
    static createTemporaryWorkingDir() {
        const osTempDir = os.tmpdir();
        const tmpDir = path.join(osTempDir, 'cplacejs-docs-builder');
        rimraf.sync(tmpDir);
        fs.mkdirSync(tmpDir);
        utils_1.debug(`Using temp directory ${tmpDir}`);
        return tmpDir;
    }
}
exports.default = DocsBuilder;
DocsBuilder.allDocsDir = 'allDocs';
