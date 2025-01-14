﻿/*
node 20230418.Fix_redirected_wikilinks_of_templates.js

這個任務會清理導航模板的重導向內部連結。
由於這個任務會遍歷所有模板，很遺憾的 MediaWiki API 並未提供進度指示，所以無法顯示整個任務的進度。現在所顯示的任務進度為相對於每個區段5000個條目的進度。

此例外也有例外：如果重定向表示較大文章中的不同子主題而不僅僅是變體名稱，則最好將重定向保留在模板中。
@see [[w:en:WP:BYPASSREDIRECT]]

2023/4/18 6:49:54	初版試營運
2023/5/15 6:33:39	機器人申請測試運作

TODO:


*/

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([
	'data.CSV',
	// for CeL.assert()
	'application.debug.log']);


// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('zh');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;


/**{String}從這個頁面開始檢核。*/
const start_from_page = 'Template:CHT'
	&& undefined
	;
/**{Boolean}已經通過檢核條目，處理所有的條目。*/
let process_all_pages = !start_from_page;


// ----------------------------------------------

/**
 * 由設定頁面讀入手動設定 manual settings。
 * 
 * @param {Object}latest_task_configuration
 *            最新的任務設定。
 */
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	if (!latest_task_configuration.general)
		latest_task_configuration.general = Object.create(null);
	const { general } = latest_task_configuration;

	//

	console.trace(wiki.latest_task_configuration.general);
}

// ----------------------------------------------------------------------------

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
	routine_task_done('1 week');
})();

// ----------------------------------------------------------------------------

async function main_process() {
	if (false) {
		const FF0D_template_list = await get_FF0D_template_list();
		console.log(`${FF0D_template_list.size} FF0D templates to process.`);

		await wiki.for_each_page(FF0D_template_list
			&& ['Template:US military navbox']
			&& ['Template:云南历史']
			&& ['Template:文革编年史']
			&& ['Template:中华人民共和国国家级风景名胜区', 'Template:台灣地景']
			&& ['Template:中華民國外交部部長']
			&& ['Template:1965年亞洲女籃錦標賽中華民國代表隊']
			&& ['Template:2011年亞足聯亞洲盃A組積分榜']
			&& ['Template:Bureaucrat candidate']
			&& ['Template:Campaignbox 中越邊境衝突', 'Template:Campaignbox 秦赵战争']
			&& ['Template:CatAZ']
			&& ['Template:English football updater']
			&& ['Template:Eulipotyphla']
			&& ['Template:Gptw']
			&& ['Template:告示牌音樂獎']
			&& ['Template:Lang']
			, for_each_template_page, {
			//summary: '[[Special:PermanentLink/76925397#需要進行之善後措施|​因應格式手冊修改]]，[[Wikipedia:格式手册/标点符号#连接号|連接號]]改用 em dash: ',
			summary: `${CeL.wiki.title_link_of(log_to, '轉換模板中的內部連結為目標頁面標題')}: `,
		});
		return;
	}

	await wiki.allpages({
		// 遍歷所有模板。
		namespace: 'template',
		apfrom: start_from_page || '',
		async for_each_slice(page_list) {
			// apfrom 不一定會剛好從所指定的頁面開始，因此必須有這道篩選。
			if (!process_all_pages) {
				while (page_list.length > 0) {
					if (page_list[0].title === start_from_page) {
						process_all_pages = true;
						CeL.info('Start from ' + page_list[0].title);
						break;
					}
					page_list.shift();
				}
				if (page_list.length === 0)
					return;
			}

			// 去掉明顯非導航模板之功能頁面。
			page_list = page_list.filter(
				page_data => !/\/(doc|draft|sandbox|沙盒|te?mp|testcases|Archives?|存檔|存档)( ?\d+)?$/i.test(page_data.title)
					// 跳過中華人民共和國行政區劃。
					&& !/^Template:PRC admin\//.test(page_data.title)
					// 跳過用戶框模板 {{Userbox}}, {{Userbox-2}}, {{User language}}。
					&& !/^Template:User /.test(page_data.title)
			);

			//CeL.set_debug();
			await wiki.for_each_page(page_list
				//&& ['Template:奥斯卡最佳影片奖']
				, for_each_template_page, {
				/*
				page_options: {
					// 查詢太頻繁，到後期會常出現異常 HTTP 狀態碼 400。
					//prop: 'revisions|links',
					// OK:
					prop: 'revisions',

					pllimit: 'max',
				},
				*/
				summary: `${CeL.wiki.title_link_of(log_to, '轉換模板中的內部連結為目標頁面標題')}: `,
				log_to,
				no_fallback_log_to_on_error: true,
				notification_name: 'fix_redirected_wikilinks',
				skip_nochange: true,
			});
		}
	});

}


async function get_FF0D_template_list() {
	// https://quarry.wmcloud.org/query/72263
	const items = CeL.parse_CSV(await (await fetch('https://quarry.wmcloud.org/run/725605/output/0/tsv')).text(), { has_title: true, skip_title: true });
	//console.log(items);

	const template_list = new Set;
	for (const item of items) {
		template_list.add(item[0]);
	}

	return template_list;
}

async function for_each_FF0D_template(template_page_data) {
	//console.log(template_page_data);

	const parsed = CeL.wiki.parser(template_page_data).parse();

	/**	link from → redirect target */
	const convert_map = new Map;

	parsed.each('link', (link_token, index, parent) => {
		// 導航欄分組通常不需要修改重定向。
		// [[w:zh:User talk:Kanashimi#清理导航模板的重导向内部链接]]
		if (parent.type === 'parameter_unit' && /^group\d$/.test(parent[0].toString().trim())) {
			return;
		}

		const link_title = link_token[0].toString();
		// U+FF0D: '－'
		if (!link_title.includes('\uFF0D'))
			return;

		// TODO: 檢測重新導向標的
		const redirects_title = link_title.replace(/\uFF0D/g, '—');
		link_token[0] = redirects_title;
		convert_map.set(link_title, redirects_title);
	});

	// TODO: 多語言模板也需要處理

	if (convert_map.size === 0)
		return Wikiapi.skip_edit;

	this.summary += Array.from(convert_map).map(pair => CeL.wiki.title_link_of(pair[0]) + '→' + CeL.wiki.title_link_of(pair[1]))
		// gettext_config:{"id":"Comma-separator"}
		.join(CeL.gettext('Comma-separator'));
	return parsed.toString();
}


function get_converted_title(link_title, redirected_targets) {
	const converted = redirected_targets.original_result.converted;
	if (!converted)
		return link_title;
	//console.trace(link_title);

	for (const data of converted) {
		if (data.from === link_title) {
			//console.trace(data);
			return data.to;
		}
	}

	return link_title;
}

async function for_each_template_page(template_page_data, messages) {
	//console.trace(template_page_data);
	//console.trace('>> ' + template_page_data.title);

	if (!template_page_data.wikitext.replace(/<noinclude>[\s\S]*?<\/noinclude>/, '')
		// @see PATTERN_redirect @ CeL.application.net.wiki.parser.misc
		.replace(/^[\s\n]*#(?:REDIRECT|重定向|重新導向|転送|リダイレクト|넘겨주기)\s*(?::\s*)?\[\[([^{}\[\]\|<>\t\n�]+)(?:\|[^\[\]{}]+?)?\]\]/i, '')
		.replace(/\[\[Category:.+?\]\]/i, '')
		.includes('[[')) {
		return Wikiapi.skip_edit;
	}

	CeL.log_temporary(`${for_each_template_page.name}: ${CeL.wiki.title_link_of(template_page_data)}`);

	const parsed = CeL.wiki.parser(template_page_data).parse();
	CeL.assert([template_page_data.wikitext, parsed.toString()], 'wikitext parser check for ' + CeL.wiki.title_link_of(template_page_data));

	const link_list = [], link_token_list = [];
	/**	from display text → to display text */
	const display_text_convert_map = new Map;
	parsed.each(token => {
		if (token.type === 'convert') {
			// 不處理 langconvert 中的連結。 e.g., [[Template:奥斯卡最佳影片奖]]
			return parsed.each.skip_inner;
		}
		if (token.type !== 'link')
			return;

		const link_token = token;
		const page_title = link_token[0].toString();
		if (!page_title || CeL.wiki.PATTERN_invalid_page_name_characters.test(page_title)) {
			// e.g., [[#anchor]], [[2019–20 {{ENGLs|NPL}}|2019–20]] @ [[w:zh:Template:English football updater]]
			return;
		}
		link_list.push(page_title);
		link_token_list.push(link_token);
		return;

		// 所有顯示文字中的 U+FF0D 轉為 U+2014: 在能判別詞條類別之前，顯示文字還是維持現狀。
		const display_text = link_token[2]?.toString();
		// U+FF0D: '－'
		if (display_text?.includes('\uFF0D')) {
			const new_display_text = display_text.replace(/\uFF0D/g, '—');
			link_token[2] = new_display_text;
			display_text_convert_map.set(display_text, new_display_text);
		}
	});

	if (link_list.length === 0) {
		// No link found.
		return Wikiapi.skip_edit;
	}

	//console.trace(link_list);
	const redirected_targets = await wiki.redirects_root(link_list, {
		multi: true,
	});
	//console.trace(redirected_targets);
	//console.trace(redirected_targets.original_result);
	//console.trace(redirected_targets.original_result.title_data_map);
	//console.trace(redirected_targets.original_result.redirects);
	//console.trace(redirected_targets.original_result.converted);
	if (!redirected_targets.original_result.redirect_from) {
		// There is no redirects in the link_list.
		return Wikiapi.skip_edit;
	}
	// assert: typeof redirected_targets.original_result.redirect_from === 'object'


	//console.trace(await wiki.embeddedin(template_page_data));
	/**{Set} 所有嵌入此模板，並且此模板有連出的頁面名稱 */
	const embeddedin_and_linked_title_Set = new Set;
	const language_variant_convert_Map = new Map;
	// IIFE
	{
		const embeddedin_and_linked_title_list = (await wiki.embeddedin(template_page_data, {
			// TODO: 取與 redirected_targets 的交集。
			page_filter(page_data) {
				//console.trace(page_data);
				return page_data.title in redirected_targets.original_result.title_data_map;
			},
		})).map(page_data => {
			embeddedin_and_linked_title_Set.add(page_data.title);
			return page_data.title;
		});
		if (embeddedin_and_linked_title_list.length === 0
			// 若太多個 embeddedin　頁面，代表非導航模板，可跳過不處理。但基本上不會遇到這情況。
			//|| embeddedin_and_linked_title_list.length > 1000
		) {
			return Wikiapi.skip_edit;
		}
		//console.trace(embeddedin_and_linked_title_list);

		/**{Map} language_variant_convert_Map[converted_title] → original_title */
		if (use_language === 'zh') {
			for (const language_variant of ['zh-hant', 'zh-hans']) {
				const converted_list = await wiki.convert_Chinese(embeddedin_and_linked_title_list, language_variant);
				embeddedin_and_linked_title_list.forEach((title, index) => {
					if (converted_list[index] !== title)
						language_variant_convert_Map.set(converted_list[index], title);
				});
			}
		}
	}
	//console.trace(embeddedin_and_linked_title_Set);


	/**	link from → redirect target */
	const link_convert_map = new Map;
	if (redirected_targets.length !== link_list.length) {
		// 有重複的標題?
		console.error([link_list, redirected_targets]);
		throw new Error('取得長度不同@' + template_page_data.title);
	}
	for (let index = 0, message_recorded_Set = new Set; index < link_list.length; index++) {
		const link_title = link_list[index];
		let redirected_target = redirected_targets[index];
		if (redirected_target.charAt(0) !== link_title.charAt(0)
			// e.g., iMac
			&& redirected_target.charAt(0) === link_title.charAt(0).toUpperCase()) {
			redirected_target = link_title.charAt(0) + redirected_target.slice(1);
		}

		/** {Array}表示重定向至章節標題: [ 重定向標的, 頁面標題, 章節標題 ] */
		const matched = redirected_target.match(/^([^#]+)(#.+)$/);
		if (!redirected_targets.original_result.redirect_from[matched ? matched[1] : redirected_target]) {
			// e.g., 非重定向的繁簡轉換標題，因此沒有重定向紀錄。機器人只會處理有重定向的繁簡標題。假如沒有重定向，機器人會跳過。
			continue;
		}
		// 不論命名空間以及空白底線的差異。
		if (wiki.normalize_title(link_title) === wiki.normalize_title(redirected_target))
			continue;

		function add_message(message_id) {
			if (message_recorded_Set.has(link_title))
				return;

			message_recorded_Set.add(link_title);
			const message = CeL.wiki.title_link_of(template_page_data) + ': ' + CeL.gettext(message_id, CeL.wiki.title_link_of(link_title) + '→' + CeL.wiki.title_link_of(redirected_target));
			CeL.log(message);
			messages.push((messages.ordered_list_count > 0 ? '#:' : ':::') + message);
		}

		// 跳過重定向到章節的連結、將之記錄在日誌中，
		if (matched) {
			// User:Ericliu1912: 重新導向到章節的連結都不用修正（除非章節變了）。倒是可以反過來，列出重新導向到章節的連結，說不定有可以給編者手動改善的地方？
			// gettext_config:{"id":"the-link-redirects-to-section-$1"}
			add_message('連結重定向到章節：%1');
			continue;
		}

		// User:寒吉: 清理該模板有嵌入的頁面連結就好。
		// 重定向至消歧義頁面，通常會因未嵌入此模板而在此被篩掉。
		if (!embeddedin_and_linked_title_Set.has(matched ? matched[0] : redirected_target)) {
			// gettext_config:{"id":"the-link-redirects-to-a-page-that-is-not-embedded-in-this-template-$1"}
			add_message('連結重定向到未嵌入該模板的頁面：%1');
			continue;
		}

		CeL.log(`${for_each_template_page.name}: ${link_title}\t→${redirected_target}`);
		link_convert_map.set(link_title, redirected_target);

		const link_token = link_token_list[index];
		if (wiki.is_namespace(redirected_target, 'File') || wiki.is_namespace(redirected_target, 'Category'))
			redirected_target = ':' + redirected_target;
		if (link_token[2] || link_token[1]) {
			;
		} else if (
			// 現在只有在繁簡轉換後相同的情況下才不保留標題。
			redirected_target !== link_title
			&& redirected_target !== get_converted_title(link_title, redirected_targets)

			// 如果是繁簡重定向，例如原標題繁體=重定向簡體，則直接取代重定向。不使用管道連結保留顯示文字。
			&& (!language_variant_convert_Map.has(link_title) || language_variant_convert_Map.get(link_title) !== redirected_target)

			// 以下為舊的考量:
			// 轉換後長度增加太多時才保留原標題為展示文字。
			//redirected_target.length - link_title.length > 4
			// e.g. [[Title 1]]→[[Title 2 (type)]]
			//|| !/ \([^()]+\)$/.test(link_title) && / \([^()]+\)$/.test(matched ? matched[1] : redirected_target)

			// e.g. [[媧皇宮]]應替換為[[娲皇宫及石刻|媧皇宮]]
			//|| redirected_target.length > link_title.length && (redirected_target.includes(link_title)
			// e.g. [[媧皇宮]]應替換為[[娲皇宫及石刻|媧皇宮]]
			//|| redirected_target.includes(get_converted_title(link_title, redirected_targets)))

		) {
			//console.trace(link_title);
			// preserve display text
			link_token[2] = link_title;
		}

		// TODO: 保留命名空間之類格式
		if (!matched) {
			link_token[0] = redirected_target;
		} else if (link_token[1].toString()) {
			CeL.error(`${for_each_template_page.name}: ${link_token}本身已包含章節標題/網頁錨點，無法改成${CeL.wiki.title_link_of(redirected_target)}`);
		} else {
			if (!link_token[2]) {
				// 保留原標題為展示文字。
				// e.g. [[九九峰自然保留區]]→[[九九峰#九九峰自然保留區|九九峰自然保留區]]
				link_token[2] = link_title;
			}
			link_token[0] = matched[1];
			link_token[1] = matched[2];
		}

		if (!link_token[1] && link_token[2]
			// using wiki.normalize_title()?
			// TODO: [[IMac|iMac]]→[[iMac]], [[IMac#ABC|iMac]]→no change
			&& link_token[0].toString() === link_token[2].toString()) {
			// assert: link_token.length === 2
			link_token.pop();
		}
		//console.trace(link_token.toString(), link_token);
	}


	const summary_list = [];
	if (link_convert_map.size > 0) {
		summary_list.push(Array.from(link_convert_map).map(pair => CeL.wiki.title_link_of(pair[0]) + '→' + CeL.wiki.title_link_of(pair[1]))
			// gettext_config:{"id":"Comma-separator"}
			.join(CeL.gettext('Comma-separator')));
	}
	if (display_text_convert_map.size > 0) {
		summary_list.push(Array.from(display_text_convert_map).map(pair => CeL.wiki.title_link_of(pair[0]) + '→' + CeL.wiki.title_link_of(pair[1]) + ' (轉換[[Wikipedia:格式手册/链接#模板中的内部链接|模板中的內部連結]]為目標頁面標題)')
			// gettext_config:{"id":"Comma-separator"}
			.join(CeL.gettext('Comma-separator')));
	}
	if (summary_list.length === 0)
		return Wikiapi.skip_edit;

	this.summary += summary_list.join('; ');
	return parsed.toString();
}
