﻿/*

2020/6/17 6:11:36	初版試營運

 */

'use strict';

// Load replace tools.
const replace_tool = require('./replace_tool.js');
//import { replace } from './replace_tool.js';

// ----------------------------------------------------------------------------

//async function main_process()
(async () => {
	await replace_tool.replace({
		language: 'ja',

		// 可省略 `diff_id` 的條件: 以新章節增加請求，且編輯摘要包含 `/* section_title */`
		// 'small_oldid/big_new_diff' or {Number}new
		diff_id: 78039963,

		// 可省略 `section_title` 的條件: 檔案名稱即 section_title
		//section_title: '',

		//summary: '',
	}, {
		//'': DELETE_PAGE,
		//'': REDIRECT_TARGET,
		//'insource:""': '',
		'赤崎千夏': REDIRECT_TARGET,
		'赤崎千夏の超!A&Gミュージック+TV': REDIRECT_TARGET,
		'insource:"赤崎千夏"': '赤﨑千夏',
	});
})();
