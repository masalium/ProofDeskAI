'use strict';

// Safe structured logger — never pass secret values as arguments here.
const METHODS = { info: 'log', warn: 'warn', error: 'error' };

function write(level, tag, message) {
  const ts = new Date().toISOString();
  console[METHODS[level]](`[${ts}] [${tag}] ${message}`);
}

module.exports = {
  info:  (tag, msg) => write('info',  tag, msg),
  warn:  (tag, msg) => write('warn',  tag, msg),
  error: (tag, msg) => write('error', tag, msg),
};
