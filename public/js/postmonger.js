(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		define('postmonger', [], function () { return factory(root); });
	} else if (typeof exports === 'object') {
		module.exports = factory(root);
	} else {
		root.Postmonger = factory(root);
	}
}(this, function (root) {
	root = root || window;
	var exports = exports || undefined;
	var Postmonger;
	var previous = root.Postmonger;
	var _window = (root.addEventListener || root.attachEvent) ? root : window;
	var Connection, Events, Session;

	if (typeof(exports) !== 'undefined') {
		Postmonger = exports;
	} else {
		Postmonger = {};
	}
	Postmonger.noConflict = function () {
		root.Postmonger = previous;
		return this;
	};
	Postmonger.version = '0.0.14';

	Events = function () {
		var eventSplitter = /\s+/;
		var self = this;
		self._callbacks = {};
		self._has = function (obj, key) {
			return Object.prototype.hasOwnProperty.call(obj, key);
		};
		self._keys = function (obj) {
			if (Object.keys) { return Object.keys(obj); }
			var keys = [];
			for (var key in obj) {
				if (self._has(obj, key)) { keys.push(key); }
			}
			return keys;
		};
		self.on = function (events, callback, context) {
			var calls, event, list, node, tail;
			if (!callback) { return self; }
			events = events.split(eventSplitter);
			self._callbacks = self._callbacks || {};
			calls = self._callbacks;
			while (event = events.shift()) {
				list = calls[event];
				node = (list) ? list.tail : {};
				tail = {};
				node.next = tail;
				node.context = context;
				node.callback = callback;
				calls[event] = {
					tail: tail,
					next: (list) ? list.next : node
				};
			}
			return self;
		};
		self.off = function (events, callback, context) {
			var calls, event, list, node, tail;
			if (!(calls = self._callbacks)) { return self; }
			if (!(events || callback || context)) {
				delete self._callbacks;
				return self;
			}
			events = (events) ? events.split(eventSplitter) : self._keys(calls);
			while (event = events.shift()) {
				list = calls[event];
				delete calls[event];
				if (!list || !(callback || context)) { continue; }
				tail = list.tail;
				while ((node = list.next) !== tail) {
					list.next = node.next;
					if ((callback && node.callback !== callback) || (context && node.context !== context)) {
						self.on(event, node.callback, node.context);
					}
				}
			}
			return self;
		};
		self.trigger = function (events) {
			var callback, args, calls, event, list, node, tail;
			if (!(calls = self._callbacks)) { return self; }
			args = Array.prototype.slice.call(arguments, 1);
			events = events.split(eventSplitter);
			while (event = events.shift()) {
				list = calls[event];
				if (!list) { continue; }
				tail = list.tail;
				node = list.next;
				while (node !== tail) {
					callback = node.callback;
					callback.apply(node.context || self, args);
					node = node.next;
				}
			}
			return self;
		};
		return self;
	};

	Postmonger.Events = Events;

	Connection = function (options) {
		options = (typeof(options) === 'object') ? options : {};
		var connect = options.connect || _window.parent;
		var from = options.from || '*';
		var to = options.to || '*';
		var self = this;

		if (typeof(connect) === 'string' && root.document) {
			connect = root.document.getElementById(connect) || root.document.querySelector(connect);
		}
		if (connect && connect.nodeName && connect.nodeName.toLowerCase() === 'iframe' && connect.contentWindow) {
			connect = connect.contentWindow;
		}
		self.postMessage = function (message) {
			if (connect && connect.postMessage) {
				if (root.navigator && root.navigator.userAgent && /MSIE [89]/.test(root.navigator.userAgent)) {
					connect.postMessage(JSON.stringify(message), to);
				} else {
					connect.postMessage(message, to);
				}
			}
		};
		return self;
	};

	Postmonger.Connection = Connection;

	Session = function () {
		var args = (arguments.length > 0) ? Array.prototype.slice.call(arguments, 0) : [{}];
		var connections = [];
		var incoming = new Events();
		var outgoing = new Events();
		var self = this;
		var connection, i, j, l, ln, listener;

		listener = function (event) {
			var message = {};
			if (typeof(event.data) === 'string') {
				try {
					message = JSON.parse(event.data);
				} catch (e) {
					return;
				}
			} else {
				message = event.data;
			}
			if (message && message.ping) {
				outgoing.trigger('pong');
				return;
			}
			if (message && message.pong) {
				incoming.trigger('pong');
				return;
			}
			if (message && message.event) {
				incoming.trigger.apply(incoming, [message.event].concat(message.arguments));
			}
		};

		if (_window.addEventListener) {
			_window.addEventListener('message', listener, false);
		} else if (_window.attachEvent) {
			_window.attachEvent('onmessage', listener);
		}
		for (i = 0, l = args.length; i < l; i++) {
			connections.push(new Connection(args[i]));
		}
		outgoing.on('all', function (event) {
			var message = {
				event: event,
				arguments: Array.prototype.slice.call(arguments, 1)
			};
			for (j = 0, ln = connections.length; j < ln; j++) {
				connections[j].postMessage(message);
			}
		});

		self.on = incoming.on;
		self.off = incoming.off;
		self.trigger = outgoing.trigger;
		return self;
	};

	Postmonger.Session = Session;
	return Postmonger;
}));
