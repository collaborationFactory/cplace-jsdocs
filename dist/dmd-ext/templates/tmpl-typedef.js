"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const template_1 = __importDefault(require("./template"));
const typedefTemplate = template_1.default `
---
title: ${0}
weight: 2
type: "section"
---

{{#typeDefs}}{{>docs}}{{/typeDefs}}
`;
exports.default = typedefTemplate;
