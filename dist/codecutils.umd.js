(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.codecutils = {})));
}(this, (function (exports) { 'use strict';

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var traverse_1 = createCommonjsModule(function (module) {
var traverse = module.exports = function (obj) {
    return new Traverse(obj);
};

function Traverse (obj) {
    this.value = obj;
}

Traverse.prototype.get = function (ps) {
    var node = this.value;
    for (var i = 0; i < ps.length; i ++) {
        var key = ps[i];
        if (!node || !hasOwnProperty.call(node, key)) {
            node = undefined;
            break;
        }
        node = node[key];
    }
    return node;
};

Traverse.prototype.has = function (ps) {
    var node = this.value;
    for (var i = 0; i < ps.length; i ++) {
        var key = ps[i];
        if (!node || !hasOwnProperty.call(node, key)) {
            return false;
        }
        node = node[key];
    }
    return true;
};

Traverse.prototype.set = function (ps, value) {
    var node = this.value;
    for (var i = 0; i < ps.length - 1; i ++) {
        var key = ps[i];
        if (!hasOwnProperty.call(node, key)) node[key] = {};
        node = node[key];
    }
    node[ps[i]] = value;
    return value;
};

Traverse.prototype.map = function (cb) {
    return walk(this.value, cb, true);
};

Traverse.prototype.forEach = function (cb) {
    this.value = walk(this.value, cb, false);
    return this.value;
};

Traverse.prototype.reduce = function (cb, init) {
    var skip = arguments.length === 1;
    var acc = skip ? this.value : init;
    this.forEach(function (x) {
        if (!this.isRoot || !skip) {
            acc = cb.call(this, acc, x);
        }
    });
    return acc;
};

Traverse.prototype.paths = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.path); 
    });
    return acc;
};

Traverse.prototype.nodes = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.node);
    });
    return acc;
};

Traverse.prototype.clone = function () {
    var parents = [], nodes = [];
    
    return (function clone (src) {
        for (var i = 0; i < parents.length; i++) {
            if (parents[i] === src) {
                return nodes[i];
            }
        }
        
        if (typeof src === 'object' && src !== null) {
            var dst = copy(src);
            
            parents.push(src);
            nodes.push(dst);
            
            forEach(objectKeys(src), function (key) {
                dst[key] = clone(src[key]);
            });
            
            parents.pop();
            nodes.pop();
            return dst;
        }
        else {
            return src;
        }
    })(this.value);
};

function walk (root, cb, immutable) {
    var path = [];
    var parents = [];
    var alive = true;
    
    return (function walker (node_) {
        var node = immutable ? copy(node_) : node_;
        var modifiers = {};
        
        var keepGoing = true;
        
        var state = {
            node : node,
            node_ : node_,
            path : [].concat(path),
            parent : parents[parents.length - 1],
            parents : parents,
            key : path.slice(-1)[0],
            isRoot : path.length === 0,
            level : path.length,
            circular : null,
            update : function (x, stopHere) {
                if (!state.isRoot) {
                    state.parent.node[state.key] = x;
                }
                state.node = x;
                if (stopHere) keepGoing = false;
            },
            'delete' : function (stopHere) {
                delete state.parent.node[state.key];
                if (stopHere) keepGoing = false;
            },
            remove : function (stopHere) {
                if (isArray(state.parent.node)) {
                    state.parent.node.splice(state.key, 1);
                }
                else {
                    delete state.parent.node[state.key];
                }
                if (stopHere) keepGoing = false;
            },
            keys : null,
            before : function (f) { modifiers.before = f; },
            after : function (f) { modifiers.after = f; },
            pre : function (f) { modifiers.pre = f; },
            post : function (f) { modifiers.post = f; },
            stop : function () { alive = false; },
            block : function () { keepGoing = false; }
        };
        
        if (!alive) return state;
        
        function updateState() {
            if (typeof state.node === 'object' && state.node !== null) {
                if (!state.keys || state.node_ !== state.node) {
                    state.keys = objectKeys(state.node);
                }
                
                state.isLeaf = state.keys.length == 0;
                
                for (var i = 0; i < parents.length; i++) {
                    if (parents[i].node_ === node_) {
                        state.circular = parents[i];
                        break;
                    }
                }
            }
            else {
                state.isLeaf = true;
                state.keys = null;
            }
            
            state.notLeaf = !state.isLeaf;
            state.notRoot = !state.isRoot;
        }
        
        updateState();
        
        // use return values to update if defined
        var ret = cb.call(state, state.node);
        if (ret !== undefined && state.update) state.update(ret);
        
        if (modifiers.before) modifiers.before.call(state, state.node);
        
        if (!keepGoing) return state;
        
        if (typeof state.node == 'object'
        && state.node !== null && !state.circular) {
            parents.push(state);
            
            updateState();
            
            forEach(state.keys, function (key, i) {
                path.push(key);
                
                if (modifiers.pre) modifiers.pre.call(state, state.node[key], key);
                
                var child = walker(state.node[key]);
                if (immutable && hasOwnProperty.call(state.node, key)) {
                    state.node[key] = child.node;
                }
                
                child.isLast = i == state.keys.length - 1;
                child.isFirst = i == 0;
                
                if (modifiers.post) modifiers.post.call(state, child);
                
                path.pop();
            });
            parents.pop();
        }
        
        if (modifiers.after) modifiers.after.call(state, state.node);
        
        return state;
    })(root).node;
}

function copy (src) {
    if (typeof src === 'object' && src !== null) {
        var dst;
        
        if (isArray(src)) {
            dst = [];
        }
        else if (isDate(src)) {
            dst = new Date(src.getTime ? src.getTime() : src);
        }
        else if (isRegExp(src)) {
            dst = new RegExp(src);
        }
        else if (isError(src)) {
            dst = { message: src.message };
        }
        else if (isBoolean(src)) {
            dst = new Boolean(src);
        }
        else if (isNumber(src)) {
            dst = new Number(src);
        }
        else if (isString(src)) {
            dst = new String(src);
        }
        else if (Object.create && Object.getPrototypeOf) {
            dst = Object.create(Object.getPrototypeOf(src));
        }
        else if (src.constructor === Object) {
            dst = {};
        }
        else {
            var proto =
                (src.constructor && src.constructor.prototype)
                || src.__proto__
                || {};
            var T = function () {};
            T.prototype = proto;
            dst = new T;
        }
        
        forEach(objectKeys(src), function (key) {
            dst[key] = src[key];
        });
        return dst;
    }
    else return src;
}

var objectKeys = Object.keys || function keys (obj) {
    var res = [];
    for (var key in obj) res.push(key);
    return res;
};

function toS (obj) { return Object.prototype.toString.call(obj) }
function isDate (obj) { return toS(obj) === '[object Date]' }
function isRegExp (obj) { return toS(obj) === '[object RegExp]' }
function isError (obj) { return toS(obj) === '[object Error]' }
function isBoolean (obj) { return toS(obj) === '[object Boolean]' }
function isNumber (obj) { return toS(obj) === '[object Number]' }
function isString (obj) { return toS(obj) === '[object String]' }

var isArray = Array.isArray || function isArray (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

var forEach = function (xs, fn) {
    if (xs.forEach) return xs.forEach(fn)
    else for (var i = 0; i < xs.length; i++) {
        fn(xs[i], i, xs);
    }
};

forEach(objectKeys(Traverse.prototype), function (key) {
    traverse[key] = function (obj) {
        var args = [].slice.call(arguments, 1);
        var t = new Traverse(obj);
        return t[key].apply(t, args);
    };
});

var hasOwnProperty = Object.hasOwnProperty || function (obj, key) {
    return key in obj;
};
});

var asyncGenerator = function () {
  function AwaitValue(value) {
    this.value = value;
  }

  function AsyncGenerator(gen) {
    var front, back;

    function send(key, arg) {
      return new Promise(function (resolve, reject) {
        var request = {
          key: key,
          arg: arg,
          resolve: resolve,
          reject: reject,
          next: null
        };

        if (back) {
          back = back.next = request;
        } else {
          front = back = request;
          resume(key, arg);
        }
      });
    }

    function resume(key, arg) {
      try {
        var result = gen[key](arg);
        var value = result.value;

        if (value instanceof AwaitValue) {
          Promise.resolve(value.value).then(function (arg) {
            resume("next", arg);
          }, function (arg) {
            resume("throw", arg);
          });
        } else {
          settle(result.done ? "return" : "normal", result.value);
        }
      } catch (err) {
        settle("throw", err);
      }
    }

    function settle(type, value) {
      switch (type) {
        case "return":
          front.resolve({
            value: value,
            done: true
          });
          break;

        case "throw":
          front.reject(value);
          break;

        default:
          front.resolve({
            value: value,
            done: false
          });
          break;
      }

      front = front.next;

      if (front) {
        resume(front.key, front.arg);
      } else {
        back = null;
      }
    }

    this._invoke = send;

    if (typeof gen.return !== "function") {
      this.return = undefined;
    }
  }

  if (typeof Symbol === "function" && Symbol.asyncIterator) {
    AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
      return this;
    };
  }

  AsyncGenerator.prototype.next = function (arg) {
    return this._invoke("next", arg);
  };

  AsyncGenerator.prototype.throw = function (arg) {
    return this._invoke("throw", arg);
  };

  AsyncGenerator.prototype.return = function (arg) {
    return this._invoke("return", arg);
  };

  return {
    wrap: function (fn) {
      return function () {
        return new AsyncGenerator(fn.apply(this, arguments));
      };
    },
    await: function (value) {
      return new AwaitValue(value);
    }
  };
}();





var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

/**
* The CodecUtils class gather some static methods that can be useful while
* encodeing/decoding data.
* CodecUtils does not have a constructor, don't try to instanciate it.
*/

var CodecUtils = function () {
  function CodecUtils() {
    classCallCheck(this, CodecUtils);
  }

  createClass(CodecUtils, null, [{
    key: "isPlatformLittleEndian",


    /**
    * Get whether or not the platform is using little endian.
    * @return {Boolen } true if the platform is little endian, false if big endian
    */
    value: function isPlatformLittleEndian() {
      var a = new Uint32Array([0x12345678]);
      var b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
      return b[0] != 0x12;
    }

    /**
    * convert an ArrayBuffer into a unicode string (2 bytes for each char)
    * Note: this method was kindly borrowed from Google Closure Compiler:
    * https://github.com/google/closure-library/blob/master/closure/goog/crypt/crypt.js
    * @param {ArrayBuffer} buf - input ArrayBuffer
    * @return {String} a string compatible with Unicode characters
    */

  }, {
    key: "arrayBufferToUnicode",
    value: function arrayBufferToUnicode(buff) {
      var buffUint8 = new Uint8Array(buff);
      var out = [],
          pos = 0,
          c = 0;

      while (pos < buffUint8.length) {
        var c1 = buffUint8[pos++];
        if (c1 < 128) {
          out[c++] = String.fromCharCode(c1);
        } else if (c1 > 191 && c1 < 224) {
          var c2 = buffUint8[pos++];
          out[c++] = String.fromCharCode((c1 & 31) << 6 | c2 & 63);
        } else if (c1 > 239 && c1 < 365) {
          // Surrogate Pair
          var c2 = buffUint8[pos++];
          var c3 = buffUint8[pos++];
          var c4 = buffUint8[pos++];
          var u = ((c1 & 7) << 18 | (c2 & 63) << 12 | (c3 & 63) << 6 | c4 & 63) - 0x10000;
          out[c++] = String.fromCharCode(0xD800 + (u >> 10));
          out[c++] = String.fromCharCode(0xDC00 + (u & 1023));
        } else {
          var c2 = buffUint8[pos++];
          var c3 = buffUint8[pos++];
          out[c++] = String.fromCharCode((c1 & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
        }
      }
      return out.join('');
    }
  }, {
    key: "unicodeToArrayBuffer",


    /**
    * convert a unicode string into an ArrayBuffer
    * Note that the str is a regular string but it will be encoded with
    * 2 bytes per char instead of 1 ( ASCII uses 1 byte/char ).
    * Note: this method was kindly borrowed from Google Closure Compiler:
    * https://github.com/google/closure-library/blob/master/closure/goog/crypt/crypt.js
    * @param {String} str - string to encode
    * @return {ArrayBuffer} the output ArrayBuffer
    */
    value: function unicodeToArrayBuffer(str) {
      var out = [],
          p = 0;
      for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c < 128) {
          out[p++] = c;
        } else if (c < 2048) {
          out[p++] = c >> 6 | 192;
          out[p++] = c & 63 | 128;
        } else if ((c & 0xFC00) == 0xD800 && i + 1 < str.length && (str.charCodeAt(i + 1) & 0xFC00) == 0xDC00) {
          // Surrogate Pair
          c = 0x10000 + ((c & 0x03FF) << 10) + (str.charCodeAt(++i) & 0x03FF);
          out[p++] = c >> 18 | 240;
          out[p++] = c >> 12 & 63 | 128;
          out[p++] = c >> 6 & 63 | 128;
          out[p++] = c & 63 | 128;
        } else {
          out[p++] = c >> 12 | 224;
          out[p++] = c >> 6 & 63 | 128;
          out[p++] = c & 63 | 128;
        }
      }

      // make a buffer out of the array
      return new Uint8Array(out).buffer;
    }
  }, {
    key: "arrayBufferToString8",


    /**
    * Convert an ArrayBuffer into a ASCII string (1 byte for each char)
    * @param {ArrayBuffer} buf - buffer to convert into ASCII string
    * @return {String} the output string
    */
    value: function arrayBufferToString8(buf) {
      return String.fromCharCode.apply(null, new Uint8Array(buf));
    }

    /**
    * Convert a ASCII string into an ArrayBuffer.
    * Note that the str is a regular string, it will be encoded with 1 byte per char
    * @param {String} str - string to encode
    * @return {ArrayBuffer}
    */

  }, {
    key: "string8ToArrayBuffer",
    value: function string8ToArrayBuffer(str) {
      var buf = new ArrayBuffer(str.length);
      var bufView = new Uint8Array(buf);
      for (var i = 0; i < str.length; i++) {
        bufView[i] = str.charCodeAt(i);
      }
      return buf;
    }

    /**
    * Write a ASCII string into a buffer
    * @param {String} str - a string that contains only ASCII characters
    * @param {ArrayBuffer} buffer - the buffer where to write the string
    * @param {Number} byteOffset - the offset to apply, in number of bytes
    */

  }, {
    key: "setString8InBuffer",
    value: function setString8InBuffer(str, buffer) {
      var byteOffset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

      if (byteOffset < 0) {
        console.warn("The byte offset cannot be negative.");
        return;
      }

      if (!buffer || !(buffer instanceof ArrayBuffer)) {
        console.warn("The buffer must be a valid ArrayBuffer.");
        return;
      }

      if (str.length + byteOffset > buffer.byteLength) {
        console.warn("The string is too long to be writen in this buffer.");
        return;
      }

      var bufView = new Uint8Array(buffer);

      for (var i = 0; i < str.length; i++) {
        bufView[i + byteOffset] = str.charCodeAt(i);
      }
    }

    /**
    * Extract an ASCII string from an ArrayBuffer
    * @param {ArrayBuffer} buffer - the buffer
    * @param {Number} strLength - number of chars in the string we want
    * @param {Number} byteOffset - the offset in number of bytes
    * @return {String} the string, or null in case of error
    */

  }, {
    key: "getString8FromBuffer",
    value: function getString8FromBuffer(buffer, strLength) {
      var byteOffset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

      if (byteOffset < 0) {
        console.warn("The byte offset cannot be negative.");
        return null;
      }

      if (!buffer || !(buffer instanceof ArrayBuffer)) {
        console.warn("The buffer must be a valid ArrayBuffer.");
        return null;
      }

      if (strLength + byteOffset > buffer.byteLength) {
        console.warn("The string is too long to be writen in this buffer.");
        return null;
      }

      return String.fromCharCode.apply(null, new Uint8Array(buffer, byteOffset, strLength));
    }

    /**
    * Serializes a JS object into an ArrayBuffer.
    * This is using a unicode JSON intermediate step.
    * @param {Object} obj - an object that does not have cyclic structure
    * @return {ArrayBuffer} the serialized output
    */

  }, {
    key: "objectToArrayBuffer",
    value: function objectToArrayBuffer(obj) {
      var buff = null;
      var objCleanClone = CodecUtils.makeSerializeFriendly(obj);

      try {
        var strObj = JSON.stringify(objCleanClone);
        buff = CodecUtils.unicodeToArrayBuffer(strObj);
      } catch (e) {
        console.warn(e);
      }

      return buff;
    }

    /**
    * Convert an ArrayBuffer into a JS Object. This uses an intermediate unicode JSON string.
    * Of course, this buffer has to come from a serialized object.
    * @param {ArrayBuffer} buff - the ArrayBuffer that hides some object
    * @return {Object} the deserialized object
    */

  }, {
    key: "ArrayBufferToObject",
    value: function ArrayBufferToObject(buff) {
      var obj = null;

      try {
        var strObj = CodecUtils.arrayBufferToUnicode(buff);
        obj = JSON.parse(strObj);
      } catch (e) {
        console.warn(e);
      }

      return obj;
    }

    /**
    * Get if wether of not the arg is a typed array
    * @param {Object} obj - possibly a typed array, or maybe not
    * @return {Boolean} true if obj is a typed array
    */

  }, {
    key: "isTypedArray",
    value: function isTypedArray(obj) {
      return obj instanceof Int8Array || obj instanceof Uint8Array || obj instanceof Uint8ClampedArray || obj instanceof Int16Array || obj instanceof Uint16Array || obj instanceof Int32Array || obj instanceof Uint32Array || obj instanceof Float32Array || obj instanceof Float64Array;
    }

    /**
    * Merge some ArrayBuffes in a single one
    * @param {Array} arrayOfBuffers - some ArrayBuffers
    * @return {ArrayBuffer} the larger merged buffer
    */

  }, {
    key: "mergeBuffers",
    value: function mergeBuffers(arrayOfBuffers) {
      var totalByteSize = 0;

      for (var i = 0; i < arrayOfBuffers.length; i++) {
        totalByteSize += arrayOfBuffers[i].byteLength;
      }

      var concatArray = new Uint8Array(totalByteSize);

      var offset = 0;
      for (var i = 0; i < arrayOfBuffers.length; i++) {
        concatArray.set(new Uint8Array(arrayOfBuffers[i]), offset);
        offset += arrayOfBuffers[i].byteLength;
      }

      return concatArray.buffer;
    }

    /**
    * In a browser, the global object is `window` while in Node, it's `GLOBAL`.
    * This method return the one that is relevant to the execution context.
    * @return {Object} the global object
    */

  }, {
    key: "getGlobalObject",
    value: function getGlobalObject() {
      var constructorHost = null;

      try {
        constructorHost = window; // in a web browser
      } catch (e) {
        try {
          constructorHost = GLOBAL; // in node
        } catch (e) {
          console.warn("You are not in a Javascript environment?? Weird.");
          return null;
        }
      }
      return constructorHost;
    }

    /**
    * Extract a typed array from an arbitrary buffer, with an arbitrary offset
    * @param {ArrayBuffer} buffer - the buffer from which we extract data
    * @param {Number} byteOffset - offset from the begining of buffer
    * @param {Function} arrayType - function object, actually the constructor of the output array
    * @param {Number} numberOfElements - nb of elem we want to fetch from the buffer
    * @return {TypedArray} output of type given by arg arrayType - this is a copy, not a view
    */

  }, {
    key: "extractTypedArray",
    value: function extractTypedArray(buffer, byteOffset, arrayType, numberOfElements) {
      if (!buffer) {
        console.warn("Input Buffer is null.");
        return null;
      }

      if (!(buffer instanceof ArrayBuffer)) {
        console.warn("Buffer must be of type ArrayBuffer");
        return null;
      }

      if (numberOfElements <= 0) {
        console.warn("The number of elements to fetch must be greater than 0");
        return null;
      }

      if (byteOffset < 0) {
        console.warn("The byte offset must be possitive or 0");
        return null;
      }

      if (byteOffset >= buffer.byteLength) {
        console.warn("The offset cannot be larger than the size of the buffer.");
        return null;
      }

      if (arrayType instanceof Function && !("BYTES_PER_ELEMENT" in arrayType)) {
        console.warn("ArrayType must be a typed array constructor function.");
        return null;
      }

      if (arrayType.BYTES_PER_ELEMENT * numberOfElements + byteOffset > buffer.byteLength) {
        console.warn("The requested number of elements is too large for this buffer");
        return;
      }

      var slicedBuff = buffer.slice(byteOffset, byteOffset + numberOfElements * arrayType.BYTES_PER_ELEMENT);
      return new arrayType(slicedBuff);
    }

    /**
    * Get some info about the given TypedArray
    * @param {TypedArray} typedArray - one of the typed array
    * @return {Object} in form of {type: String, signed: Boolean, bytesPerElements: Number, byteLength: Number, length: Number}
    */

  }, {
    key: "getTypedArrayInfo",
    value: function getTypedArrayInfo(typedArray) {
      var type = null;
      var signed = false;

      if (typedArray instanceof Int8Array) {
        type = "int";
        signed = false;
      } else if (typedArray instanceof Uint8Array) {
        type = "int";
        signed = true;
      } else if (typedArray instanceof Uint8ClampedArray) {
        type = "int";
        signed = true;
      } else if (typedArray instanceof Int16Array) {
        type = "int";
        signed = false;
      } else if (typedArray instanceof Uint16Array) {
        type = "int";
        signed = true;
      } else if (typedArray instanceof Int32Array) {
        type = "int";
        signed = false;
      } else if (typedArray instanceof Uint32Array) {
        type = "int";
        signed = true;
      } else if (typedArray instanceof Float32Array) {
        type = "float";
        signed = false;
      } else if (typedArray instanceof Float64Array) {
        type = "float";
        signed = false;
      }

      return {
        type: type,
        signed: signed,
        bytesPerElements: typedArray.BYTES_PER_ELEMENT,
        byteLength: typedArray.byteLength,
        length: typedArray.length
      };
    }

    /**
    * Counts the number of typed array obj has as attributes
    * @param {Object} obj - an Object
    * @return {Number} the number of typed array
    */

  }, {
    key: "howManyTypedArrayAttributes",
    value: function howManyTypedArrayAttributes(obj) {
      var typArrCounter = 0;
      traverse_1(obj).forEach(function (x) {
        typArrCounter += CodecUtils.isTypedArray(x);
      });
      return typArrCounter;
    }

    /**
    * Check if the given object contains any circular reference.
    * (Circular ref are non serilizable easily, we want to spot them)
    * @param {Object} obj - An object to check
    * @return {Boolean} true if obj contains circular refm false if not
    */

  }, {
    key: "hasCircularReference",
    value: function hasCircularReference(obj) {
      var hasCircular = false;
      traverse_1(obj).forEach(function (x) {
        if (this.circular) {
          hasCircular = true;
        }
      });
      return hasCircular;
    }

    /**
    * Remove circular dependencies from an object and return a circularRef-free version
    * of the object (does not change the original obj), of null if no circular ref was found
    * @param {Object} obj - An object to check
    * @return {Object} a circular-ref free object copy if any was found, or null if no circ was found
    */

  }, {
    key: "removeCircularReference",
    value: function removeCircularReference(obj) {
      var hasCircular = false;
      var noCircRefObj = traverse_1(obj).map(function (x) {
        if (this.circular) {
          this.remove();
          hasCircular = true;
        }
      });
      return hasCircular ? noCircRefObj : null;
    }

    /**
    * Clone the object and replace the typed array attributes by regular Arrays.
    * @param {Object} obj - an object to alter
    * @return {Object} the clone if ant typed array were changed, or null if was obj didnt contain any typed array.
    */

  }, {
    key: "replaceTypedArrayAttributesByArrays",
    value: function replaceTypedArrayAttributesByArrays(obj) {
      var hasTypedArray = false;

      var noTypedArrClone = traverse_1(obj).map(function (x) {
        if (CodecUtils.isTypedArray(x)) {
          // here, we cannot call .length directly because traverse.map already serialized
          // typed arrays into regular objects
          var origSize = Object.keys(x).length;
          var untypedArray = new Array(origSize);

          for (var i = 0; i < origSize; i++) {
            untypedArray[i] = x[i];
          }
          this.update(untypedArray);
          hasTypedArray = true;
        }
      });
      return hasTypedArray ? noTypedArrClone : null;
    }

    /**
    * Creates a clone, does not alter the original object.
    * Remove circular dependencies and replace typed arrays by regular arrays.
    * Both will make the serialization possible and more reliable.
    * @param {Object} obj - the object to make serialization friendly
    * @return {Object} a clean clone, or null if nothing was done
    */

  }, {
    key: "makeSerializeFriendly",
    value: function makeSerializeFriendly(obj) {
      var newObj = obj;
      var noCircular = CodecUtils.removeCircularReference(newObj);

      if (noCircular) newObj = noCircular;

      var noTypedArr = CodecUtils.replaceTypedArrayAttributesByArrays(newObj);

      if (noTypedArr) newObj = noTypedArr;

      return newObj;
    }
  }]);
  return CodecUtils;
}(); /* END of class CodecUtils */

exports.CodecUtils = CodecUtils;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=codecutils.umd.js.map
