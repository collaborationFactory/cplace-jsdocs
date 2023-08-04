"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const template_1 = __importDefault(require("./template"));
const namespaceTemplate = (0, template_1.default) `
---
title: ${0}
weight: 2
type: "section"
---

{{#namespace name="${0}"}}{{>docs}}{{/namespace}}
`;
exports.default = namespaceTemplate;
