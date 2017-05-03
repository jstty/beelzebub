const fs   = require('fs');
const path = require('path');
const _    = require('lodash');

function splice (srcStr, idx, str) {
    return srcStr.slice(0, idx) + str + srcStr.slice(idx);
};

// </head>
function injectBefore (fileName, tag, injectText) {
    let fileData = fs.readFileSync(fileName, {encoding: 'utf8'});

    let tagPos = fileData.indexOf(tag);
    if (tagPos >= 0) {
        let outData = splice(fileData, tagPos, injectText);
        fs.writeFileSync(fileName, outData, {encoding: 'utf8'});
    }
}

function searchReplace (fileName, search, replace) {
    let fileData = fs.readFileSync(fileName, {encoding: 'utf8'});
    let outData = fileData.replace(search, replace);
    fs.writeFileSync(fileName, outData, {encoding: 'utf8'});
}

function injectExampleLinks (basePath, markdown) {
  let reStr = '\{\@embed ([A-Za-z\.\/]*)}';
  let re = new RegExp(reStr, 'g');
  let matches = markdown.match(re);
  _.forEach(matches, (item) => {
    let re = new RegExp(reStr, 'g');
    let found = re.exec(item);
    // console.log('item:', item, ', found:', found);

    if (found && found.length > 1) {
      found = found[1];

      try {
        let fileData = fs.readFileSync(path.resolve(basePath, found), {encoding: 'utf8'});
        let startTag = '<EXAMPLE>';
        let endTag   = '</EXAMPLE>';
        let startIdx = fileData.indexOf(startTag);
        let endIdx = fileData.indexOf(endTag);
        if (startIdx < 0) {
          console.warn('Does not have Example Tags! File:', found);
          startIdx = 0;
        }
        else { startIdx += startTag.length + 1; }

        if (endIdx < 0) {
          endIdx = fileData.length;
        }
        else { endIdx -= 3; }

        let sampleCode = fileData.substring(startIdx, endIdx);

        markdown = markdown.replace(item, sampleCode);
        // console.log('sampleData:', sampleData);
      }
      catch (err) {
        console.error('injectExampleLinks Error:', err);
      }
    }
  });
  return markdown;
}

function injectExampleLinksIntoFile (basePath, fileName) {
    let fileData = fs.readFileSync(fileName, {encoding: 'utf8'});
    let outData = injectExampleLinks(basePath, fileData);
    fs.writeFileSync(fileName, outData, {encoding: 'utf8'});
}

module.exports = {
    splice,
    searchReplace,
    injectBefore,
    injectExampleLinks,
    injectExampleLinksIntoFile
};