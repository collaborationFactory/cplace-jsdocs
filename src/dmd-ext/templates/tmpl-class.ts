import template from './template';

const classTemplate: Function = template`
---
title: ${0}
weight: 2
type: "section"
---

{{#class name="${0}"}}{{>docs}}{{/class}}
`;


export default classTemplate;