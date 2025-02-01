'use strict';
// console.log('worker ok!');

importScripts('config.js');
importScripts('worker/utils.js');
importScripts('libs/jgeoip-polyfill.js', 'libs/jgeoip.js', 'worker/coreIP2Country.js');
importScripts('worker/coreActionInfo.js');
importScripts('worker/initAllTabs.js');
importScripts('worker/context.js');
