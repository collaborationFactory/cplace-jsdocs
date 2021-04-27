import template from './template';

const frontMatterTemplate: Function = template`
---
title: ${0}
weight: 30
type: "section"
---
`;

export default frontMatterTemplate;