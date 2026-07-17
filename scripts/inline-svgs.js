const fs = require('fs');
const path = require('path');
const htmlPath = path.join(__dirname, '..', 'renderer', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const regex = /<img\s+src="svg\/(.*?)\.svg"[^>]*>/g;

html = html.replace(regex, (match, name) => {
  const svgPath = path.join(__dirname, '..', 'renderer', 'svg', name + '.svg');
  let svgContent = fs.readFileSync(svgPath, 'utf8');
  
  // Add width 100% height auto to svg root
  svgContent = svgContent.replace(/<svg\s/, '<svg style="width:100%;height:auto;" ');
  
  return svgContent;
});

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Inlined SVGs!');
