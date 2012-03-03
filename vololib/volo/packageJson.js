/**
 * @license Copyright (c) 2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/volojs/volo for details
 */

/*jslint */
/*global define, console */

define(function (require) {
    'use strict';

    var path = require('path'),
        fs = require('fs'),
        lang = require('./lang'),
        commentStartRegExp = /\/\*\s*package\.json\s*/g,
        commentEndRegExp = /\s*\*\//,
        endsInJsRegExp = /\.js$/;


    //Used to find the indices within a file for the /*package.json */
    //comment and a JSON segment inside it. If the result.end is not -1 it
    //means a proper comment was found.
    function getCommentIndices(text) {
        var match = commentStartRegExp.exec(text),
            pairMatch,
            result = {
                start: -1,
                end: -1,
                jsonStart: -1,
                jsonEnd: -1
            };

        if (match) {
            result.start = match.index;

            //Search for the end of the comment. Need to be careful of
            //contents in strings that look like end of comment. For now,
            //just using a "match the curlies" approach, but this would
            //fail if a string property has a { or } without a match within
            //the string.
            pairMatch = lang.findMatchingPair(text, '{', '}',
                                            result.start + match[0].length);

            result.jsonStart = pairMatch.start;
            result.jsonEnd = pairMatch.end;

            if (result.jsonEnd !== -1) {
                //Have a real json end, find the comment end.
                match = commentEndRegExp.exec(text.substring(result.jsonEnd));
                if (match) {
                    result.end = result.jsonEnd + match.index + match[0].length;
                }
            }
        }

        return result;
    }

    function extractCommentData(file) {
        var text = fs.readFileSync(file, 'utf8'),
            indices = getCommentIndices(text),
            json;

        if (indices.end === -1) {
            //No valid comment
            return null;
        } else {
            json = text.substring(indices.jsonStart, indices.jsonEnd + 1);
            return JSON.parse(json);
        }
    }

    function saveCommentData(file, data) {
        var text = fs.readFileSync(file, 'utf8'),
            indices = getCommentIndices(text),
            json = JSON.stringify(data, null, '  ');

        if (indices.end === -1) {
            //No valid comment, so insert it.
            //TODO: would be nice to place this under the license comment,
            //if there is one.
            text = '/*package.json \n' +
                    json +
                    '\n*/\n' +
                    text;
        } else {
            text = text.substring(0, indices.jsonStart) +
                   json +
                   text.substring(indices.jsonEnd + 1);
        }

        fs.writeFileSync(file, text, 'utf8');
    }

    function PackageInfo() {
            this.file = null;
            this.data = null;
            this.singleFile = false;
    }

    PackageInfo.prototype = {
        refresh: function () {
            if (this.singleFile) {
                this.data = extractCommentData(this.file);
            } else {
                this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
            }
        },

        save: function () {
            if (this.data) {
                if (this.singleFile) {
                    saveCommentData(this.file, this.data);
                } else {
                    fs.writeFileSync(this.file,
                                     JSON.stringify(this.data, null, '  '),
                                     'utf8');
                }
            }
        },

        addVoloDep: function (id, archiveName) {
            lang.setObject(this, 'data.volo.dependencies');
            this.data.volo.dependencies[id] = archiveName;
        }
    };

    function packageJson(fileOrDir) {
        var result = new PackageInfo(),
        packagePath = path.join(fileOrDir, 'package.json'),
        jsFiles, filePath, packageData;

        if (fs.statSync(fileOrDir).isFile()) {
            //A .js file that may have a package.json content
            result.file = fileOrDir;
            result.singleFile = true;
            result.refresh();
        } else {
            //Check for /*package.json */ in a .js file if it is the
            //only .js file in the dir.
            jsFiles = fs.readdirSync(fileOrDir).filter(function (item) {
                return endsInJsRegExp.test(item);
            });

            if (jsFiles.length === 1) {
                filePath = path.join(fileOrDir, jsFiles[0]);
                packageData = extractCommentData(filePath);
            }

            if (packageData || !path.existsSync(packagePath)) {
                result.data = packageData;
                result.file = filePath;
                result.singleFile = true;
            } else if (path.existsSync(packagePath)) {
                //Plain package.json case
                result.file = path.join(fileOrDir, 'package.json');
                result.refresh();
            }
        }

        return result;
    }

    packageJson.getCommentIndices = getCommentIndices;
    packageJson.extractCommentData = extractCommentData;
    packageJson.saveCommentData = saveCommentData;

    return packageJson;
});
