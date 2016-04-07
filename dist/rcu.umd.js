(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.rcu = global.rcu || {})));
}(this, function (exports) { 'use strict';

  var babelHelpers = {};
  babelHelpers.typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };
  babelHelpers;

  var charToInteger = {};
  var integerToChar = {};

  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='.split('').forEach(function (char, i) {
  	charToInteger[char] = i;
  	integerToChar[i] = char;
  });

  function encode(value) {
  	var result, i;

  	if (typeof value === 'number') {
  		result = encodeInteger(value);
  	} else {
  		result = '';
  		for (i = 0; i < value.length; i += 1) {
  			result += encodeInteger(value[i]);
  		}
  	}

  	return result;
  }

  function encodeInteger(num) {
  	var result = '',
  	    clamped;

  	if (num < 0) {
  		num = -num << 1 | 1;
  	} else {
  		num <<= 1;
  	}

  	do {
  		clamped = num & 31;
  		num >>= 5;

  		if (num > 0) {
  			clamped |= 32;
  		}

  		result += integerToChar[clamped];
  	} while (num > 0);

  	return result;
  }

  /**
   * Encodes a string as base64
   * @param {string} str - the string to encode
   * @returns {string}
   */
  function btoa$1(str) {
    return new Buffer(str).toString('base64');
  }

  function SourceMap(properties) {
  	this.version = 3;

  	this.file = properties.file;
  	this.sources = properties.sources;
  	this.sourcesContent = properties.sourcesContent;
  	this.names = properties.names;
  	this.mappings = properties.mappings;
  }

  SourceMap.prototype = {
  	toString: function toString() {
  		return JSON.stringify(this);
  	},
  	toUrl: function toUrl() {
  		return 'data:application/json;charset=utf-8;base64,' + btoa$1(this.toString());
  	}
  };

  var alreadyWarned = false;

  /**
   * Generates a v3 sourcemap between an original source and its built form
   * @param {object} definition - the result of `rcu.parse( originalSource )`
   * @param {object} options
   * @param {string} options.source - the name of the original source file
   * @param {number=} options.offset - the number of lines in the generated
     code that precede the script portion of the original source
   * @param {string=} options.file - the name of the generated file
   * @returns {object}
   */
  function generateSourceMap(definition) {
  	var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  	if ('padding' in options) {
  		options.offset = options.padding;

  		if (!alreadyWarned) {
  			console.warn('rcu: options.padding is deprecated, use options.offset instead'); // eslint-disable-line no-console
  			alreadyWarned = true;
  		}
  	}

  	var mappings = '';

  	if (definition.scriptStart) {
  		// The generated code probably includes a load of module gubbins - we don't bother
  		// mapping that to anything, instead we just have a bunch of empty lines
  		var offset = new Array((options.offset || 0) + 1).join(';');
  		var lines = definition.script.split('\n');

  		var encoded = undefined;

  		if (options.hires !== false) {
  			(function () {
  				var previousLineEnd = -definition.scriptStart.column;

  				encoded = lines.map(function (line, i) {
  					var lineOffset = i === 0 ? definition.scriptStart.line : 1;

  					var encoded = encode([0, 0, lineOffset, -previousLineEnd]);

  					var lineEnd = line.length;

  					for (var j = 1; j < lineEnd; j += 1) {
  						encoded += ',CAAC';
  					}

  					previousLineEnd = i === 0 ? lineEnd + definition.scriptStart.column : Math.max(0, lineEnd - 1);

  					return encoded;
  				});
  			})();
  		} else {
  			encoded = lines.map(function (line, i) {
  				if (i === 0) {
  					// first mapping points to code immediately following opening <script> tag
  					return encode([0, 0, definition.scriptStart.line, definition.scriptStart.column]);
  				}

  				if (i === 1) {
  					return encode([0, 0, 1, -definition.scriptStart.column]);
  				}

  				return 'AACA'; // equates to [ 0, 0, 1, 0 ];
  			});
  		}

  		mappings = offset + encoded.join(';');
  	}

  	return new SourceMap({
  		file: options.file || null,
  		sources: [options.source || null],
  		sourcesContent: [definition.source],
  		names: [],
  		mappings: mappings
  	});
  }

  function getName(path) {
  	var pathParts = path.split('/');
  	var filename = pathParts.pop();

  	var lastIndex = filename.lastIndexOf('.');
  	if (lastIndex !== -1) filename = filename.substr(0, lastIndex);

  	return filename;
  }

  var Ractive = undefined;

  function init(copy) {
  	Ractive = copy;
  }

  var _eval;
  var isBrowser;
  var isNode;
  var head;
  var Module;
  var base64Encode;
  var SOURCE_MAPPING_URL = 'sourceMappingUrl';
  var DATA = 'data';

  // This causes code to be eval'd in the global scope
  _eval = eval;

  if (typeof document !== 'undefined') {
  	isBrowser = true;
  	head = document.getElementsByTagName('head')[0];
  } else if (typeof process !== 'undefined') {
  	isNode = true;
  	Module = (require.nodeRequire || require)('module');
  }

  if (typeof btoa === 'function') {
  	base64Encode = function (str) {
  		str = str.replace(/[^\x00-\x7F]/g, function (char) {
  			var hex = char.charCodeAt(0).toString(16);
  			while (hex.length < 4) hex = '0' + hex;

  			return '\\u' + hex;
  		});

  		return btoa(str);
  	};
  } else if (typeof Buffer === 'function') {
  	base64Encode = function (str) {
  		return new Buffer(str, 'utf-8').toString('base64');
  	};
  } else {
  	base64Encode = function () {};
  }

  function eval2(script, options) {
  	options = options || {};

  	if (options.sourceMap) {
  		script += '\n//# ' + SOURCE_MAPPING_URL + '=data:application/json;charset=utf-8;base64,' + base64Encode(JSON.stringify(options.sourceMap));
  	} else if (options.sourceURL) {
  		script += '\n//# sourceURL=' + options.sourceURL;
  	}

  	try {
  		return _eval(script);
  	} catch (err) {
  		if (isNode) {
  			locateErrorUsingModule(script, options.sourceURL || '');
  			return;
  		}

  		// In browsers, only locate syntax errors. Other errors can
  		// be located via the console in the normal fashion
  		else if (isBrowser && err.name === 'SyntaxError') {
  				locateErrorUsingDataUri(script);
  			}

  		throw err;
  	}
  }

  eval2.Function = function () {
  	var i,
  	    args = [],
  	    body,
  	    wrapped,
  	    options;

  	i = arguments.length;
  	while (i--) {
  		args[i] = arguments[i];
  	}

  	if (typeof args[args.length - 1] === 'object') {
  		options = args.pop();
  	} else {
  		options = {};
  	}

  	// allow an array of arguments to be passed
  	if (args.length === 1 && Object.prototype.toString.call(args) === '[object Array]') {
  		args = args[0];
  	}

  	if (options.sourceMap) {
  		options.sourceMap = clone(options.sourceMap);

  		// shift everything a line down, to accommodate `(function (...) {`
  		options.sourceMap.mappings = ';' + options.sourceMap.mappings;
  	}

  	body = args.pop();
  	wrapped = '(function (' + args.join(', ') + ') {\n' + body + '\n})';

  	return eval2(wrapped, options);
  };

  function locateErrorUsingDataUri(code) {
  	var dataURI, scriptElement;

  	dataURI = DATA + ':text/javascript;charset=utf-8,' + encodeURIComponent(code);

  	scriptElement = document.createElement('script');
  	scriptElement.src = dataURI;

  	scriptElement.onload = function () {
  		head.removeChild(scriptElement);
  	};

  	head.appendChild(scriptElement);
  }

  function locateErrorUsingModule(code, url) {
  	var m = new Module();

  	try {
  		m._compile('module.exports = function () {\n' + code + '\n};', url);
  	} catch (err) {
  		console.error(err);
  		return;
  	}

  	m.exports();
  }

  function clone(obj) {
  	var cloned = {},
  	    key;

  	for (key in obj) {
  		if (obj.hasOwnProperty(key)) {
  			cloned[key] = obj[key];
  		}
  	}

  	return cloned;
  }

  /**
   * Finds the line and column position of character `char`
     in a (presumably) multi-line string
   * @param {array} lines - an array of strings, each representing
     a line of the original string
   * @param {number} char - the character index to convert
   * @returns {object}
       * @property {number} line - the zero-based line index
       * @property {number} column - the zero-based column index
       * @property {number} char - the character index that was passed in
   */
  function getLinePosition(lines, char) {
  	var line = 0;
  	var lineStart = 0;

  	var lineEnds = lines.map(function (line) {
  		lineStart += line.length + 1; // +1 for the newline
  		return lineStart;
  	});

  	lineStart = 0;

  	while (char >= lineEnds[line]) {
  		lineStart = lineEnds[line];
  		line += 1;
  	}

  	var column = char - lineStart;
  	return { line: line, column: column, char: char };
  }

  var requirePattern = /require\s*\(\s*(?:"([^"]+)"|'([^']+)')\s*\)/g;
  var TEMPLATE_VERSION = 3;

  function parse(source) {
  	if (!Ractive) {
  		throw new Error('rcu has not been initialised! You must call rcu.init(Ractive) before rcu.parse()');
  	}

  	var parsed = Ractive.parse(source, {
  		noStringify: true,
  		interpolate: { script: false, style: false },
  		includeLinePositions: true
  	});

  	if (parsed.v !== TEMPLATE_VERSION) {
  		throw new Error('Mismatched template version (expected ' + TEMPLATE_VERSION + ', got ' + parsed.v + ')! Please ensure you are using the latest version of Ractive.js in your build process as well as in your app');
  	}

  	var links = [];
  	var styles = [];
  	var modules = [];

  	// Extract certain top-level nodes from the template. We work backwards
  	// so that we can easily splice them out as we go
  	var template = parsed.t;
  	var i = template.length;
  	var scriptItem = undefined;

  	while (i--) {
  		var item = template[i];

  		if (item && item.t === 7) {
  			if (item.e === 'link' && item.a && item.a.rel === 'ractive') {
  				links.push(template.splice(i, 1)[0]);
  			}

  			if (item.e === 'script' && (!item.a || !item.a.type || item.a.type === 'text/javascript')) {
  				if (scriptItem) {
  					throw new Error('You can only have one <script> tag per component file');
  				}
  				scriptItem = template.splice(i, 1)[0];
  			}

  			if (item.e === 'style' && (!item.a || !item.a.type || item.a.type === 'text/css')) {
  				styles.push(template.splice(i, 1)[0]);
  			}
  		}
  	}

  	// Clean up template - trim whitespace left over from the removal
  	// of <link>, <style> and <script> tags from start...
  	while (/^\s*$/.test(template[0])) {
  		template.shift();
  	} // ...and end
  	while (/^\s*$/.test(template[template.length - 1])) {
  		template.pop();
  	} // Extract names from links
  	var imports = links.map(function (link) {
  		var href = link.a.href;
  		var name = link.a.name || getName(href);

  		if (typeof name !== 'string') {
  			throw new Error('Error parsing link tag');
  		}

  		return { name: name, href: href };
  	});

  	var result = {
  		source: source, imports: imports, modules: modules,
  		template: parsed,
  		css: styles.map(function (item) {
  			return item.f;
  		}).join(' '),
  		script: ''
  	};

  	// extract position information, so that we can generate source maps
  	if (scriptItem && scriptItem.f) {
  		var content = scriptItem.f[0];

  		var contentStart = source.indexOf('>', scriptItem.p[2]) + 1;

  		// we have to jump through some hoops to find contentEnd, because the contents
  		// of the <script> tag get trimmed at parse time
  		var contentEnd = contentStart + content.length + source.slice(contentStart).replace(content, '').indexOf('</script');

  		var lines = source.split('\n');

  		result.scriptStart = getLinePosition(lines, contentStart);
  		result.scriptEnd = getLinePosition(lines, contentEnd);

  		result.script = source.slice(contentStart, contentEnd);

  		// replace comments with spaces (perserves line numbers while removing commented out requires)
  		var len = undefined,
  		    cleanScript = result.script;
  		do {
  			len = cleanScript.length;
  			cleanScript = cleanScript.replace(/\/\/(.*?)\n/, '\n', 'm');
  			cleanScript = cleanScript.replace(/\/\*(.*?)\*\//, function (_, str) {
  				return str.split('\n').map(function (str) {
  					return ' '.repeat(str.length);
  				}).join('\n');
  			}, 'm');
  		} while (len !== cleanScript.length);

  		cleanScript.replace(requirePattern, function (match, doubleQuoted, singleQuoted) {
  			var source = doubleQuoted || singleQuoted;
  			if (! ~modules.indexOf(source)) modules.push(source);
  			return match;
  		});
  	}

  	return result;
  }

  function make(source, config, callback, errback) {
  	config = config || {};

  	// Implementation-specific config
  	var url = config.url || '';
  	var loadImport = config.loadImport;
  	var loadModule = config.loadModule;

  	var definition = parse(source);

  	var imports = {};

  	function createComponent() {
  		var options = {
  			template: definition.template,
  			partials: definition.partials,
  			css: definition.css,
  			components: imports
  		};

  		var Component = undefined;

  		if (definition.script) {
  			var sourceMap = generateSourceMap(definition, {
  				source: url,
  				content: source
  			});

  			try {
  				var factory = new eval2.Function('component', 'require', 'Ractive', definition.script, {
  					sourceMap: sourceMap
  				});

  				var component = {};
  				factory(component, config.require, Ractive);
  				var exports = component.exports;

  				if ((typeof exports === 'undefined' ? 'undefined' : babelHelpers.typeof(exports)) === 'object') {
  					for (var prop in exports) {
  						if (exports.hasOwnProperty(prop)) {
  							options[prop] = exports[prop];
  						}
  					}
  				}

  				Component = Ractive.extend(options);
  			} catch (err) {
  				errback(err);
  				return;
  			}

  			callback(Component);
  		} else {
  			Component = Ractive.extend(options);
  			callback(Component);
  		}
  	}

  	// If the definition includes sub-components e.g.
  	//     <link rel='ractive' href='foo.html'>
  	//
  	// ...then we need to load them first, using the loadImport method
  	// specified by the implementation.
  	//
  	// In some environments (e.g. AMD) the same goes for modules, which
  	// most be loaded before the script can execute
  	var remainingDependencies = definition.imports.length + (loadModule ? definition.modules.length : 0);
  	var ready = false;

  	if (remainingDependencies) {
  		(function () {
  			var onloaded = function onloaded() {
  				if (! --remainingDependencies) {
  					if (ready) {
  						createComponent();
  					} else {
  						setTimeout(createComponent); // cheap way to enforce asynchrony for a non-Zalgoesque API
  					}
  				}
  			};

  			if (definition.imports.length) {
  				if (!loadImport) {
  					throw new Error('Component definition includes imports (e.g. <link rel="ractive" href="' + definition.imports[0].href + '">) but no loadImport method was passed to rcu.make()');
  				}

  				definition.imports.forEach(function (toImport) {
  					loadImport(toImport.name, toImport.href, url, function (Component) {
  						imports[toImport.name] = Component;
  						onloaded();
  					});
  				});
  			}

  			if (loadModule && definition.modules.length) {
  				definition.modules.forEach(function (name) {
  					loadModule(name, name, url, onloaded);
  				});
  			}
  		})();
  	} else {
  		setTimeout(createComponent, 0);
  	}

  	ready = true;
  }

  function resolvePath(relativePath, base) {
  	// If we've got an absolute path, or base is '', return
  	// relativePath
  	if (!base || relativePath.charAt(0) === '/') {
  		return relativePath;
  	}

  	// 'foo/bar/baz.html' -> ['foo', 'bar', 'baz.html']
  	var pathParts = (base || '').split('/');
  	var relativePathParts = relativePath.split('/');

  	// ['foo', 'bar', 'baz.html'] -> ['foo', 'bar']
  	pathParts.pop();

  	var part = undefined;

  	while (part = relativePathParts.shift()) {
  		if (part === '..') {
  			pathParts.pop();
  		} else if (part !== '.') {
  			pathParts.push(part);
  		}
  	}

  	return pathParts.join('/');
  }

  exports.generateSourceMap = generateSourceMap;
  exports.getName = getName;
  exports.init = init;
  exports.make = make;
  exports.parse = parse;
  exports.resolve = resolvePath;

}));