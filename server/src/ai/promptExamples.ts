import type { DiagramIntent } from './classify'

export const EXAMPLES: Partial<Record<DiagramIntent, string>> = {
  show_me: `Example — "show me a human heart":
{"layout":"freeform","nodes":[
  {"id":"heart","label":"Heart","shape":"ellipse","size":"xl"},
  {"id":"lv","label":"Left Ventricle","shape":"text","size":"sm"},
  {"id":"aorta","label":"Aorta","shape":"text","size":"sm"},
  {"id":"pa","label":"Pulmonary Artery","shape":"text","size":"sm"}
],"edges":[{"from":"lv","to":"heart"},{"from":"aorta","to":"heart"},{"from":"pa","to":"heart"}]}`,

  wireframe: `Example — "wireframe a dashboard":
{"layout":"freeform","nodes":[
  {"id":"header","label":"Header","shape":"rectangle"},
  {"id":"sidebar","label":"Sidebar","shape":"rectangle"},
  {"id":"chart","label":"Chart","shape":"rectangle"},
  {"id":"table","label":"Table","shape":"rectangle"}
],"edges":[]}`,

  system_design: `Example — "system design for a url shortener":
{"layout":"hierarchy","groups":[
  {"id":"client","label":"Client"},{"id":"gateway","label":"Gateway"},
  {"id":"services","label":"Services"},{"id":"data","label":"Data"}
],"nodes":[
  {"id":"browser","label":"Browser","shape":"rectangle","group":"client"},
  {"id":"lb","label":"Load Balancer","shape":"diamond","group":"gateway"},
  {"id":"api","label":"API Service","shape":"rectangle","group":"services"},
  {"id":"cache","label":"Redis Cache","shape":"ellipse","group":"data"},
  {"id":"db","label":"Database","shape":"ellipse","group":"data"}
],"edges":[{"from":"browser","to":"lb"},{"from":"lb","to":"api"},{"from":"api","to":"cache"},{"from":"api","to":"db"}]}`,
}
