# Rick Tracy [![Travis][build-badge]][build] [![npm package][npm-badge]][npm]

Detective Rick Tracy is a pluggable dependency graph array generator written in js.

This tool was designed to generated a very simple tree structure which I could use in a gulp workflow to look up the entry point js files from any level of dependency. How this differs from similar tools is that this is designed for projects that are mixed with ES6 imports and Common JS requires, it returns a usable final tree object, and it offers a lot of options for filtering and processing how modules are discovered.

## Features

- Works with ES6 `import` and Common JS `require` mixed in the same source files.
- Has similar options to [module-deps](https://github.com/substack/labeled-stream-splicer) for filtering, mapping, and post-resolution filtering ids.
- Uses a [labeled stream splicer](labeled stream splicer) to allow total manipulation of the stream pipeline.

## Installation

To install from NPM:

`sudo npm install rick-tracy`

Manually via git:

`git clone https://github.com/jayzawrotny/rick-tracy.git`

In node (ES5):

```
var RickTracy = require('rick-tracy');
```

In node (ES6):

```
import RickTracy from 'rick-tracy';
```

## Usage

```js
import fs from 'fs';
import JSONStream from 'JSONStream';
import RickTracy from 'rick-tracy';

let rickTracy = new RickTracy({
 // the usual suspects ;)
 lineup: 'path/to/entry/points/**/*.js'
});

// Build the dependency graph and write to a writable stream
rickTracy.investigate()
  .then((caseFile) => {
    console.log(caseFile);
  })

// Or get the tree from the complete handler
rickTracy.investigate()
 .on('complete', (caseFile) => {
   console.log(caseFile);
 });

// Or create your own stream pipeline
rickTracy.read()
  .pipe(rickTracy.pipeline)
  // Could also be replaced with any writable stream
  .pipe(rickTracy.report((caseFile) => {
    console.log(caseFile);
  });

// Customizing the pipeline

rickTracy.pipeline.get('trace').unshift(through2.obj((file, enc, done) => {
  // Allows you to modify the vinyl entry point files before tracing begins.
  console.log(file);

  // Normal through stream stuff
  done(null, file);
}));

// Writes the dependency tree to a text file as part of the pipeline
let output = new fs.createWriteStream('tree.txt');

// Is appended to the pipeline after storing into the tree structure
rickTracy.pipline.get('store').push(output);
```

### Options

#### lineup _(string | array)_
``'**/*.js'`` `['**/*.js', '!**/_*.js']`

A glob string to find entry points relative to `process.cwd()`. Used by [vinyl-fs](https://github.com/gulpjs/vinyl-fs) to send vinyl entry point files to the pipeline for tracing.

```js
new RickTracy({
  lineup: '**/*.js',
});
```

#### filter _(function:boolean)_
`function (id)`

A filter function to run against new module paths as they are discovered and before RickTracy uses nodeResolve to find its absolute path. The function must return a boolean.

```js
new RickTracy({
  trace: {
    filter: function (id) {
      return !id.includes('craiginald'); // Nobody wants anything to do with Craiginald.
    }
  }
})
```
The above example filters out any ids with the word 'craginald' in them.

#### postFilter _(function:boolean)_
`function (id)`

Another filter function to run against a resolved node module which may include an absolute path.

```js
new RickTracy({
  trace: {
    postFilter: function (id) {
      return !id.includes('node_modules'); // Ignore any modules in the node_modules directory.
    }
  }
});
```

#### map _(function:string)_
`function (id) { return id }`

The map function allows you to modify module ids after they have been filtered, but before they get resolved to an actual location.

```js
new RickTracy({
  trace: {
    map: function (id) {
      return path.join(__dirname, id);
    }
  }
})
```

The above example prepends the dirname to the module id if you had something like `require('myfile')` it would be mapped to `/path/to/myfile`;

### compileES6Modules _(boolean:true)_

Specify if you want to compile the ES6 `import` statements to commonJS `require` statements.

```js
new RickTracy({
  trace: {
    compileES6Modules: false, // Will speed up trace process if no ES6 imports are used.
  }
})
```

### ignorePackages _(boolean:true)_

Specify if you want Rick Tracy to ignore npm packages in the dependency graph. The default is true. The intended use case is to generate a graph for the app source and not the modules.

```js
new RickTracy({
  trace: {
    ignorePackages: false, // Will include node_module packages too
  }
})
```

## Customization

### Pipeline

The pipeline is a [labeled stream splicer](labeled stream splicer) generated with each new `RickTracy` instance. Each pipe in the pipeline is a type of stream consumer either a duplex stream or a transform stream. The stream splicer allows the post creation manipulation of each step in the flow. For instance, you can add a transform stream before any input is sent to the tracer to filter or generate more files to trace. After tracing you could then add another step to affect what is sent to the store. Then after the store you could add another transform stream to affect what is output at the end. The main idea here is that any step can be replaced, removed, prepended or appended to at your discretion.

Below is an example for adding a basic logging step.

```js
import RickTracy from 'rick-tracy';

let rickTracy = new RickTracy({
  lineup: 'path/to/entry/points/**/*.js'
});

rickTracy.pipeline.get('trace').unshift(through.obj((file, enc, done) => {
  console.log("I'm the vinyl file before getting traced.", file.path);
  done(null, file);
}))

rickTracy.investigate()
  .then((caseFile) => {
    // Whatever you need the tree for.
  });
```

#### Trace
`rickTracy.pipeline.get('trace')`

Traces the input vinyl files through all their children and their children's dependencies. Emits each dependency that it finds.

**Input:** Vinyl file object

**Output:**
```js
// Will be generated for each module it discovers and resolves
{
  suspect: '/entry/point/file.js',
  leads: [
    '/sub/dependency/of/entry/point.js',
    '/sub/depdendency/of/entry/point.js',
  ],
  source: null, // Used for sub dependencies of dependencies.
}
```

#### Store
`rickTracy.pipeline.get('store')`

Stores the module dependency in a flat array that it can then traverse later to build the final dependency tree.

**Input:**
```js
{
  suspect: '/entry/point/file.js',
  leads: [
    '/sub/dependency/of/entry/point.js',
    '/sub/depdendency/of/entry/point.js',
  ],
  source: null, // Used for sub dependencies of dependencies.
}
```

**Output:**
```js
// Final dependency graph tree
{
  '/entry/point/file.js': {
    '/sub/dep.js': {
      '/sub/sub/dep.js': {},
    },
    '/sub/dep2.js': {}
  }
}
```


## CLI
Currently I have not added any CLI functionality. If you would like me to implement it please let me know. If you really want CLI you can create a pull request :smile:.

## About

### Credits
This tool was lovingly made for use at [VenueBook](https://venuebook.com/).

### License
BSD-3-Clause (c) 2016 VenueBook, Inc.

[labeled stream splicer)]: https://github.com/substack/labeled-stream-splicer

[npm-badge]: https://img.shields.io/npm/v/rick-tracy.svg?style=flat-square
[npm]: https://www.npmjs.org/package/rick-tracy