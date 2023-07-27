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
exports.CplaceJSDocs = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const utils_1 = require("../utils");
const DocsBuilder_1 = __importDefault(require("../builder/DocsBuilder"));
const formatting_1 = require("../utils/formatting");
class CplaceJSDocs {
    constructor(buildConfig) {
        this.buildConfig = buildConfig;
        if (buildConfig.debug) {
            (0, utils_1.enableDebug)();
        }
        this.plugins = this.setup(buildConfig);
        console.log(`(CplaceJSDocs) Configured for repos ${buildConfig.repos} - useTypescript? ${buildConfig.useTypescript}`);
    }
    build() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.plugins.size) {
                console.log('No plugins with cplaceJS docs found');
                return new Promise(resolve => resolve());
            }
            const mainRepoPath = this.getMainRepoPath();
            if (mainRepoPath === null) {
                (0, utils_1.debug)(`(CplaceJSDocs) Main repo cannot be found...`);
                return new Promise((resolve, reject) => reject('Main repo cannot be found...'));
            }
            const startTime = new Date().getTime();
            console.log(`(CplaceJSDocs) Found ${this.plugins.size} plugins with jsdoc: ${Array.from(this.plugins.keys()).join(', ')}`);
            const docsBuilder = new DocsBuilder_1.default(this.plugins, this.buildConfig.destination, !!this.buildConfig.useTypescript);
            yield docsBuilder.start();
            const endTime = new Date().getTime();
            console.log(`CplaceJS docs built successfully (${(0, formatting_1.formatDuration)(endTime - startTime)})`);
        });
    }
    setup(buildConfig) {
        let repoPaths;
        const plugins = new Map();
        const mainRepoPath = this.getMainRepoPath();
        if (mainRepoPath === null) {
            console.error(`(CplaceJSDocs) Main repo cannot be found...`);
            process.exit(1);
        }
        (0, utils_1.debug)(`(CplaceJSDocs) Building cplaceJS docs for all repos... `);
        repoPaths = this.getAllPotentialRepos();
        repoPaths.forEach(repoPath => {
            const files = fs.readdirSync(repoPath);
            files.forEach(file => {
                const filePath = path.join(repoPath, file);
                if (fs.lstatSync(filePath).isDirectory()) {
                    const potentialPluginName = path.basename(file);
                    if (CplaceJSDocs.directoryLooksLikePlugin(filePath) && CplaceJSDocs.pluginHasCplaceJSDocs(filePath, buildConfig)) {
                        plugins.set(potentialPluginName, filePath);
                    }
                }
            });
        });
        return plugins;
    }
    getAllPotentialRepos() {
        const repos = new Set();
        const mainRepoPath = this.getMainRepoPath();
        if (mainRepoPath != null) {
            const containingDir = path.resolve(path.join(mainRepoPath, '..'));
            const files = fs.readdirSync(containingDir);
            files.forEach(file => {
                const filePath = path.join(containingDir, file);
                if (fs.lstatSync(filePath).isDirectory() || fs.lstatSync(filePath).isSymbolicLink()) {
                    repos.add(filePath);
                }
            });
        }
        return repos;
    }
    getRepoRoot() {
        return this.buildConfig.repos;
    }
    getMainRepoPath() {
        let mainRepoPath;
        mainRepoPath = path.resolve(path.join(this.getRepoRoot(), CplaceJSDocs.CPLACE_REPO_NAME));
        // if repo is checked out as cplace
        if (!fs.existsSync(mainRepoPath)) {
            mainRepoPath = path.resolve(path.join(this.getRepoRoot(), CplaceJSDocs.CPLACE_REPO_ALT_NAME));
        }
        if (!fs.existsSync(path.join(mainRepoPath, CplaceJSDocs.PLATFORM_PLUGIN_NAME))) {
            return null;
        }
        return mainRepoPath;
    }
    static directoryLooksLikePlugin(pluginPath) {
        return fs.existsSync(path.join(pluginPath, 'src'));
    }
    static pluginHasCplaceJSDocs(pluginPath, buildConfig) {
        const docsPath = path.join(pluginPath, 'assets', 'cplaceJS');
        let hasCplaceJSDocs = fs.existsSync(docsPath) && fs.lstatSync(docsPath).isDirectory() && !buildConfig.useTypescript;
        if (!hasCplaceJSDocs) {
            const alternativeDocsPath = path.join(pluginPath, 'src', 'main', 'resources', 'cplaceJS');
            hasCplaceJSDocs = fs.existsSync(alternativeDocsPath) && fs.lstatSync(alternativeDocsPath).isDirectory();
        }
        return hasCplaceJSDocs;
    }
}
exports.CplaceJSDocs = CplaceJSDocs;
CplaceJSDocs.CPLACE_REPO_NAME = 'main';
CplaceJSDocs.CPLACE_REPO_ALT_NAME = 'cplace';
CplaceJSDocs.PLATFORM_PLUGIN_NAME = 'cf.cplace.platform';
CplaceJSDocs.DESCRIPTOR_FILE_NAME = 'pluginDescriptor.json';
