# Rick Tracy
Detective Rick Tracy is a pluggable dependency graph array generator written in js.

## Todo

- [x] Completed main source
- [x] Implement [Labeled Stream Splicer](https://github.com/substack/labeled-stream-splicer)
- [x] Write a readable stream for testing that pushes content from an array.
- [x] Write Unit tests for each class.
- [x] Write a test for the final workflow.
- [ ] Document all the things in the readme.

## Features

- Works with ES6 imports and Common JS `require` mixed in the same source files.
- Has similar options to `module-deps` for filtering, mapping, and post-resolution filtering ids.
- Uses a labeled stream splicer to allow stream transforms before and after tracing and creating the dependency graph.

## Installation

To install from NPM:

`sudo npm install rick-tracy`

Manually via git:

`git clone https://github.com/jayzawrotny/rick-tracy.git`

In node (ES5):

`var RickTracy = require('rick-tracy');`

In node (ES6):

`import RickTracy from 'rick-tracy';`

## Usage

```js
import fs from 'fs';
import JSONStream from 'JSONStream';
import RickTracy from 'rick-tracy';

let rickTracy = new RickTracy({
 // the usual suspects ;)
 lineup: 'path/to/entry/points/**\/*.js'
});

rickTracy.pipeline.get('trace').unshift(through2.obj((file, enc, done) => {
  // Allows you to modify the vinyl entry point files before tracing begins.
  console.log(file);

  // Normal through stream stuff
  done(null, file);
}));

// Writes the depdendency tree to a text file as part of the pipeline
let output = new fs.createWriteStream('tree.txt');

// Is appended to the pipeline after storing into the tree structure
rickTracy.pipline.get('store').push(output);

// Build the dependency graph and write to a writable stream
rickTracy.investigate()
 .pipe(JSONStream.stringify())
 .pipe(fs.createWriteStream('out.txt'))

// Or get the tree from the complete handler
rickTracy.investigate()
 .on('complete', (caseFile) => {
   console.log(caseFile);
 });

// Or retrive it from a writable callback
rickTracy.investigate()
  .pipe(rickTracy.report((caseFile) => {
    console.log(caseFile);
  });
```

## Customization

## CLI
Currently I have not added any CLI functionality. If you would like me to implement it please let me know. If you really want CLI you can create a pull request.

## About

### Credits
This tool was lovingly made for use at [VenueBook](https://venuebook.com/).

### License
BSD-3-Clause (c) 2015 VenueBook, Inc. (https://venuebook.com)
