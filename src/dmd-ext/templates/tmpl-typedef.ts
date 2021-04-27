import template from './template';

const typedefTemplate: Function = template`
---
title: ${0}
weight: 2
type: "section"
---

{{#typeDefs}}{{>docs}}{{/typeDefs}}
`;


export default typedefTemplate;