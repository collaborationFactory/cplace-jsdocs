import template from './template';

const namespaceTemplate: Function = template`
---
title: ${0}
weight: 2
type: "section"
---

{{#namespace name="${0}"}}{{>docs}}{{/namespace}}
`;


export default namespaceTemplate;