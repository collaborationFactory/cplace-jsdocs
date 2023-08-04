"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
const path_1 = require("path");
class DocsBuilder {
    constructor(plugins, destination, useTypescript) {
        this.plugins = plugins;
        this.destination = destination;
        this.useTypescript = useTypescript;
        this.workingDir = DocsBuilder.createTemporaryWorkingDir();
        if (!this.destination) {
            this.destination = path.join(this.workingDir, 'out');
        }
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            (0, fs_extra_1.ensureDirSync)(this.destination);
            console.log(`Collecting docs from plugins... (useTypescript: ${this.useTypescript})`);
            this.copyDocsFromPlugins();
            const docsSource = this.getAllDocsPaths();
            let displayNameToPluginMap = new Map();
            Object.keys(docsSource).forEach((plugin) => {
                const pathsForJsdoc = {
                    cplacePlugin: plugin,
                    sourceDir: docsSource[plugin],
                    jsdocPlugin: require.resolve('../lib/cplaceJsdocPlugin'),
                };
                let metaData = this.buildForPlugin(plugin, pathsForJsdoc);
                if (!!metaData) {
                    displayNameToPluginMap.set(metaData.displayName, plugin.replace(/\./g, '-').toLowerCase());
                }
            });
            if (this.useTypescript) {
                // Need to build the docs all in one go, buildForPlugin only prepares the data in the case using typescript
                console.log('Building docs using typedoc');
                let docsSourcePath = path.join(this.workingDir, DocsBuilder.allDocsDir);
                yield this.buildTypedoc(docsSourcePath, this.destination);
                console.log('Finished building docs using typedoc');
                this.removeUnderscoresFromFilenames(this.destination);
                this.addAliasesAndFixLinks(this.destination, displayNameToPluginMap);
            }
        });
    }
    buildTypedoc(docsSourcePath, outputPath) {
        return __awaiter(this, void 0, void 0, function* () {
            docsSourcePath = docsSourcePath.replace(/\\/g, '/');
            outputPath = outputPath.replace(/\\/g, '/');
            console.log(`Trying to generate Typedoc in ${docsSourcePath}, generate in ${outputPath}`);
            let tsconfigString = `{
            "compilerOptions": {
                "moduleDetection": "auto",
                "noEmit": true,
                "baseUrl": "./",
                "typeRoots": [
                    "./non_existent_or_empty_directory"
                ],
                "lib": ["ES2020"]
            },
            "include": [
                "${docsSourcePath}/*.d.ts"
            ],
        }`;
            fs.writeFileSync(path.resolve(docsSourcePath, 'tsconfig.json'), tsconfigString);
            let typedocConfigString = `{
            "$schema": "https://typedoc.org/schema.json",
            "entryPoints": [
              "${docsSourcePath}/*.d.ts"
            ],
            "out": "${outputPath}",
            "plugin": [
                "typedoc-plugin-markdown",
                "typedoc-hugo-theme",
                "cplace-typedoc-hugo-plugin"
            ],
            "excludePrivate": true,
            "skipErrorChecking": true,
            "theme": "hugo",
            "disableSources": true,
            "name": "Low-Code API"
        }`;
            fs.writeFileSync(path.resolve(docsSourcePath, 'typedoc.json'), typedocConfigString);
            let currentDir = process.cwd();
            process.chdir(docsSourcePath);
            console.log(`Changed cwd from ${currentDir} to ${process.cwd()}`);
            const TypeDoc = require('typedoc');
            const app = new TypeDoc.Application();
            let base = path.resolve(docsSourcePath);
            // If you want TypeDoc to load tsconfig.json / typedoc.json files
            app.options.addReader(new TypeDoc.TSConfigReader());
            app.options.addReader(new TypeDoc.TypeDocReader());
            yield app.bootstrapWithPlugins();
            const project = app.convert();
            if (project) {
                // Project may not have converted correctly
                // Rendered docs
                yield app.generateDocs(project, outputPath);
                console.log('Typedoc docs generated in folder: ' + outputPath);
            }
            else {
                console.error('Could not generate Typedoc docs');
                throw new Error('Could not generate Typedoc docs');
            }
            process.chdir(currentDir);
            console.log(`Changed cwd back to ${process.cwd()}`);
        });
    }
    addAliasesAndFixLinks(directory, displayNameToPluginMap) {
        console.log(`Adding aliases to *.md files in ${directory} and fix underscores in module names`);
        (0, fs_1.readdirSync)(directory).forEach((fileName) => {
            const filePath = (0, path_1.resolve)(directory, fileName);
            // _index.ts file should stay intact
            if ((0, fs_1.lstatSync)(filePath).isFile() && fileName !== '_index.md' && fileName.endsWith('.md')) {
                this.addAliasInFileAndFixLinks(filePath, fileName, displayNameToPluginMap);
            }
            else if ((0, fs_1.lstatSync)(filePath).isDirectory()) {
                this.addAliasesAndFixLinks(filePath, displayNameToPluginMap);
            }
        });
    }
    addAliasInFileAndFixLinks(filePath, fileName, displayNameToPluginMap) {
        let fileContent = (0, fs_1.readFileSync)(filePath, {
            encoding: 'utf8',
        }).toString();
        let fileNameParts = fileName.split('.');
        let displayNamePart = fileNameParts[0];
        let mappedDisplayNamePart = displayNamePart.replace(/ /g, '_'); // Originally the file had underscores instead of blanks
        let mappedModuleName = displayNameToPluginMap.get(mappedDisplayNamePart);
        if (!!mappedModuleName) {
            let alias = '../' + mappedModuleName;
            if (fileNameParts.length > 2) {
                let detailName = fileNameParts[1].toLowerCase();
                alias = alias + '/' + detailName;
                console.log(`Adding alias to file ${filePath}: ${alias}`);
            }
            fileContent = fileContent.replace(/^---/, `---\naliases:\n- ${alias}`);
        }
        console.log(`Adjusting underscores in module names in file ${filePath}`);
        // Now replace all occurences of all module names (i.e. all the ones with underscore) with one containing
        // blanks instead (so that we display e.g. "Office reports" instead of "Office_reports" everywhere
        displayNameToPluginMap.forEach((value, displayNameWithUnderscore, map) => {
            let displayNameWithoutUnderscore = displayNameWithUnderscore.replace(/_/g, ' ');
            let displayNameWithEscapedUnderscore = displayNameWithUnderscore.replace(/_/g, '\\\\_');
            fileContent = fileContent.replace(new RegExp(displayNameWithUnderscore, 'g'), displayNameWithoutUnderscore);
            fileContent = fileContent.replace(new RegExp(displayNameWithEscapedUnderscore, 'g'), displayNameWithoutUnderscore);
        });
        (0, fs_1.writeFileSync)(filePath, fileContent);
    }
    removeUnderscoresFromFilenames(directory) {
        console.log(`Removing underscores from filenames is directory ${directory}`);
        (0, fs_1.readdirSync)(directory).forEach((fileName) => {
            const filePath = (0, path_1.resolve)(directory, fileName);
            // _index.ts file should stay intact
            if ((0, fs_1.lstatSync)(filePath).isFile() && fileName !== '_index.md' && fileName.endsWith('.md')) {
                let newFilename = fileName.replace(/_/g, ' ');
                let newFilepath = (0, path_1.resolve)(directory, newFilename);
                fs.renameSync(filePath, newFilepath);
            }
            else if ((0, fs_1.lstatSync)(filePath).isDirectory()) {
                this.removeUnderscoresFromFilenames(filePath);
            }
        });
    }
    buildForPlugin(plugin, jsdocPaths) {
        // if plugin does not contain any js files return
        if (!this.containsLowCodeDocFiles(path.join(jsdocPaths.sourceDir, 'docs'))) {
            return undefined;
        }
        let metaData = DocsBuilder.getMetaData(jsdocPaths.sourceDir, plugin);
        if (!metaData.displayName) {
            console.error(`(CplaceJSDocs) Incorrect meta data cannot build docs for ${plugin}`);
            return undefined;
        }
        if (!this.useTypescript) {
            const outputPath = path.join(this.destination, plugin.replace(/\W+/gi, '-').toLowerCase());
            (0, fs_extra_1.mkdirpSync)(outputPath);
            const pluginFm = (0, tmpl_fromtMatter_1.default)(metaData.displayName);
            (0, fs_extra_1.outputFileSync)(path.join(outputPath, '_index.md'), pluginFm);
            let docsData = jsdoc_to_markdown_1.default.getTemplateDataSync({
                'no-cache': true,
                files: path.join(jsdocPaths.sourceDir, 'docs', '/**/*.js'),
            });
            // group different types of entities
            const groups = (0, BuilderUtils_1.groupData)(docsData);
            (0, BuilderUtils_1.generateLinks)(plugin, groups);
            Object.keys(groups).forEach((group) => {
                // typedefs are handled later
                if (group === 'typedef') {
                    return;
                }
                const templateClosure = DocsBuilder.getTemplateClosure(group);
                for (const entry of groups[group]) {
                    const template = templateClosure(entry);
                    (0, utils_1.debug)(`rendering ${entry}`);
                    const output = jsdoc_to_markdown_1.default.renderSync({
                        data: docsData,
                        template: template,
                        helper: require.resolve('../dmd-ext/helper/helpers'),
                    });
                    const filePath = path.resolve(outputPath, `${entry.toLowerCase()}.md`);
                    fs.writeFileSync(filePath, output);
                    (0, utils_1.debug)(`Written file:  ${filePath}`);
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
        else {
            metaData.displayName = metaData.displayName.replace(/ /g, '_');
            this.concatenateTypescriptDefinitions(path.resolve(jsdocPaths.sourceDir, 'docs'), metaData.displayName, ['globals.d.ts', 'cplace-extension.d.ts']);
        }
        return metaData;
    }
    concatenateTypescriptDefinitions(pluginDocsPath, pluginName, excludeFiles) {
        let outputFile = path.resolve(pluginDocsPath, '..', '..', pluginName + '.d.ts');
        console.log(`Concatenating *.d.ts files from directory ${pluginDocsPath} for plugin ${pluginName} to file ${outputFile} - excluded files are: ${excludeFiles}.`);
        let files = fs.readdirSync(pluginDocsPath);
        files.forEach(file => {
            let absoluteFile = path.resolve(pluginDocsPath, file);
            let stats = fs.lstatSync(absoluteFile);
            if (stats.isFile() && file.endsWith('.d.ts') && !excludeFiles.includes(file)) {
                console.log(`Adding contents of file ${file}`);
                let contents = fs.readFileSync(absoluteFile);
                fs.appendFileSync(outputFile, contents + '\n');
            }
            else {
                console.log(`Ignoring file ${file}`);
            }
        });
        return outputFile;
    }
    copyDocsFromPlugins() {
        this.plugins.forEach((pluginPath, pluginName) => {
            const docsPath = path.join(pluginPath, 'assets', 'cplaceJS');
            const alternativeDocsPath = path.join(pluginPath, 'src', 'main', 'resources', 'cplaceJS');
            if (!this.useTypescript && DocsBuilder.canCopyDocs(docsPath)) {
                (0, fs_extra_1.copySync)(docsPath, path.join(this.workingDir, DocsBuilder.allDocsDir, pluginName));
            }
            else if (DocsBuilder.canCopyDocs(alternativeDocsPath)) {
                (0, fs_extra_1.copySync)(alternativeDocsPath, path.join(this.workingDir, DocsBuilder.allDocsDir, pluginName));
            }
        });
    }
    static canCopyDocs(dir) {
        return ((0, fs_1.existsSync)(dir) && (0, fs_1.lstatSync)(dir).isDirectory());
    }
    containsLowCodeDocFiles(dir) {
        if (!(0, fs_1.existsSync)(dir)) {
            return false;
        }
        const files = fs.readdirSync(dir);
        for (let i = 0; i < files.length; i++) {
            const filename = path.join(dir, files[i]);
            const stat = fs.lstatSync(filename);
            if (stat.isDirectory()) {
                if (this.containsLowCodeDocFiles(filename)) {
                    return true;
                }
            }
            else if ((this.useTypescript && filename.indexOf('.d.ts') >= 0) || (!this.useTypescript && filename.indexOf('.js') >= 0)) {
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
        (0, utils_1.debug)(`Using temp directory ${tmpDir}`);
        return tmpDir;
    }
}
DocsBuilder.allDocsDir = 'allDocs';
exports.default = DocsBuilder;
