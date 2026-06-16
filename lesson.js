if (!the_class) {
	var the_class = {

		title: "",
		language: "",
		level: "",
		type: "",
		subtype: "",
		number: "",
		stages: {}
	}
};
if (!the_index) {
	var the_index = {

		title: "",
		language: "",
		level: "",
		course: "",
		sections: {}
	}
};

/*
Types of entry:

Inputs:
Conversation -OK-
Instruction -OK-
Prompt -OK-
Text -OK-
Flashcards -OK-
Target Language -OK-
Picture -OK-
Video -OK-
Audio -OK-

Exercises:
Matching -OK-
Multiselection -OK-
Gap fill -OK-
Completion OK-
Unscrambling OK-
Selection OK-
Checking -OK-
Essay -OK-
Naming -OK-
Picking -OK-
*/

var videosList = [];
var container = document.querySelector("#lesson-content");
var xmlns = "http://www.w3.org/2000/svg";
// processClass();

function processMaterial() {
	var url = new URL(window.location);
	if (url.searchParams.get("index") != null) {
		processIndex();
	} else {
		processClass(false);
	};
}

function processIndex() {
	var hex = document.querySelector("#hex");
	hex.src = "asa-hex-" + the_index.level.toLowerCase() + ".png";

	var flag = document.querySelector("#lesson-flag");
	flag.src = "" + the_index.language + ".png"
	var langSpan = document.querySelector("#lesson-lang");
	langSpan.innerHTML = the_index.language.toUpperCase();

	var container = document.querySelector("#lesson-content");
	container.innerHTML = "";
	var indextitle = document.createElement("h1");
	indextitle.innerHTML = the_index.title;
	
	var container = document.querySelector("#lesson-content");
	container.innerHTML = "";
	var sectionNumber = 1;
	var indextitle = document.createElement("h1");
	indextitle.innerHTML = the_index.title;

	container.append(indextitle);
	for (section in the_index.sections) {
		processIndexSection(container, the_index.sections[section], sectionNumber);
		sectionNumber++;
	};
	container.innerHTML = container.innerHTML.replace(/[\u{1F300}-\u{1F5FF}|\u{1F1E6}-\u{1F1FF}|\u{2700}-\u{27BF}|\u{1F900}-\u{1F9FF}|\u{1F600}-\u{1F64F}|\u{1F680}-\u{1F6FF}|\u{2300}-\u{26FF}|\u{200d}|]{1,7}/ug, "<span class=\"emoji\">$&</span>")
};


function processIndexSection(container, section, sectionNumber) {
	var lessonNumber = 1;
	var sectiontitle = document.createElement("h2");
	sectiontitle.className = "section";
	sectiontitle.innerHTML = section.title;
	sectiontitle.setAttribute("document-section", sectionNumber);
	var sectionTable = document.createElement("table");
	sectionTable.className = "sec-table";
	sectionTable.setAttribute("document-section", sectionNumber);
	var sectionHeader = document.createElement("thead");
	var sectionBody = document.createElement("tbody");
	var headerRow = document.createElement("tr");

	var headerTexts = {
		"en":["Title", "Type", "Subtype", "Target Language"],
		"es":["Título", "Tipo", "Subtipo", "Lenguaje Objetivo"],
		"fr":["Titre", "Type", "Sous-type", "Langue objectif"],
		"it":["Titolo", "Tipo", "Sottotipo", "Linguaggio obiettivo"],
		"pt":["Título", "Tipo", "Subtipo", "Idioma objetivo"],
		"de":["Titel", "Typ", "Untertyp", "Zielsprache"]
	}; 
	for (item of headerTexts[the_index.language.toLowerCase()]) {
		var itemCell = document.createElement("th");
		itemCell.innerHTML = item;
		headerRow.append(itemCell);
	};
	sectionHeader.append(headerRow);
	sectionTable.append(sectionHeader, sectionBody);
	
	container.append(sectiontitle, sectionTable);

	for (lesson in section.lessons) {
		processIndexLesson(container, section.lessons[lesson], sectionNumber, lessonNumber);
		lessonNumber++;
	};
};

function processIndexLesson(container, lesson, sectionNumber, lessonNumber) {
	var table = document.querySelector("table[document-section=\"" + sectionNumber + "\"]");

	var indexSource = the_index.sections["section" + sectionNumber].lessons["lesson" + lessonNumber];
	var row = document.createElement("tr");
	table.children[1].append(row);
	var titlecell = document.createElement("td");
	titlecell.innerHTML = "<a class=\"indexlink\" href=\"" + indexSource.link + "\"></a><p><span class=\"n\">"+ lessonNumber + ". </span>" + indexSource.title + "</p>";
	var typecell = document.createElement("td");
	typecell.innerHTML = "<p>" + indexSource.type + "</p>";
	var subtypecell = document.createElement("td");
	subtypecell.innerHTML = "<p>" + indexSource.subtype + "</p>";
	var tlcell = document.createElement("td");
	tlcell.innerHTML = "<p>" + indexSource.targetlanguage + "</p>";

	row.append(titlecell, typecell, subtypecell, tlcell);
};


function processClass(builder) {
	var hex = document.querySelector("#hex");
	hex.src = "asa-hex-" + the_class.level.toLowerCase() + ".png";
	document.querySelector("#hex").parentElement.href = "?lang=" + the_class.language + "&course=" + the_class.course + "&level=" + the_class.level + "&class=000&index";

	var flag = document.querySelector("#lesson-flag");
	flag.src = "" + the_class.language + ".png"
	var langSpan = document.querySelector("#lesson-lang");
	langSpan.innerHTML = the_class.language.toUpperCase();

	var lessontype = document.querySelector("#lesson-type");
	lessontype.innerHTML = the_class.type.toLowerCase();
	var lessonsubtype = document.querySelector("#lesson-subtype");
	lessonsubtype.innerHTML = the_class.subtype.toLowerCase();

	var container = document.querySelector("#lesson-content");
	container.innerHTML = "";
	var stageNumber = 1;
	var classtitle = document.createElement("h1");
	classtitle.innerHTML = the_class.title;

	container.append(classtitle);
	for (stage in the_class.stages) {
		processClassStage(container, the_class.stages[stage], stageNumber);
		stageNumber++;
	};
	if (builder == false) {
		onYouTubePlayerAPIReady();
	}
	if (document.querySelector("#debug")) {
		document.querySelector("#debug").value = JSON.stringify(the_class, null, 4);
		document.querySelector("#debug").setAttribute("rows", JSON.stringify(the_class, null, 4).split("\n").length)
	};
	container.innerHTML = container.innerHTML.replace(/[\u{1F300}-\u{1F5FF}|\u{1F1E6}-\u{1F1FF}|\u{2700}-\u{27BF}|\u{1F900}-\u{1F9FF}|\u{1F600}-\u{1F64F}|\u{1F680}-\u{1F6FF}|\u{2300}-\u{26FF}|\u{200d}|]{1,7}/ug, "<span class=\"emoji\">$&</span>")
	toggleTree(document.querySelector("[onclick='toggleTree(this)']"));
};

function processClassStage(container, stage, stageNumber) {
	var entryNumber = 1;
	var stagetitle = document.createElement("h2");
	stagetitle.className = "stage";
	stagetitle.innerHTML = "<span class=\"n\">" + stageNumber + ". </span>"
	stagetitle.innerHTML += stage.title;
	stagetitle.setAttribute("document-stage", stageNumber);
	container.append(stagetitle);

	for (entry in stage.entries) {
		processClassEntry(container, stage.entries[entry], stageNumber, entryNumber);
		entryNumber++;
	};
};


////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
////////////////////////////////////////////////////////


function processClassEntry(container, entry, stageNumber, entryNumber) {

	switch (entry.type) {

		case "instruction":
			var instr = document.createElement("p");
			instr.setAttribute("document-stage", stageNumber);
			instr.setAttribute("document-entry", entryNumber);
			instr.innerHTML = "⯈ ";
			instr.innerHTML = instr.innerHTML + entry.content;
			instr.className = "stage-i";
			container.append(instr);
			if (entry.manual == true) {
				var checkDone = document.createElement("input");
				checkDone.setAttribute("type", "checkbox");
				checkDone.setAttribute("onclick", "this.parentElement.classList.toggle(\"right\"); checkForGreen()");
				instr.append(checkDone);
			};
			break;

		case "prompt":
			var prompt = document.createElement("p");
			prompt.setAttribute("document-stage", stageNumber);
			prompt.setAttribute("document-entry", entryNumber);
			prompt.innerHTML = prompt.innerHTML + entry.content;
			prompt.className = "stage-p";
			container.append(prompt);
			break;

		case "text":
			var border = document.createElement("blockquote");
			border.setAttribute("document-stage", stageNumber);
			border.setAttribute("document-entry", entryNumber);
			var text = document.createElement("span");
			text.innerHTML = entry.content.replace(/\|/g, "<br>");
			border.append(text);
			if (entry.timer == true) {
				text.className = "blurred";
				var textcontrols = document.createElement("div");
				textcontrols.setAttribute("document-stage", stageNumber);
				textcontrols.setAttribute("document-entry", entryNumber);
				textcontrols.className = "stage-c";
				var startbutton = document.createElement("button");
				startbutton.setAttribute("onclick", "showText(this, " + entry.t + ")");
				startbutton.innerHTML = "🏁";
				var againbutton = document.createElement("button");
				againbutton.setAttribute("onclick", "againText(this)");
				againbutton.innerHTML = "⟲";
				againbutton.setAttribute("disabled", "");
				textcontrols.append(startbutton, againbutton);
				container.append(textcontrols);
			};
			container.append(border);
			break;

		case "picture":
			var pic = document.createElement("img");
			pic.setAttribute("document-stage", stageNumber);
			pic.setAttribute("document-entry", entryNumber);
			pic.setAttribute("onclick", "document.exitFullscreen()");
			pic.src = entry.url;
			pic.className = "mainpic";
			
			var piccontrols = document.createElement("div");
			piccontrols.setAttribute("document-stage", stageNumber);
			piccontrols.setAttribute("document-entry", entryNumber);
			piccontrols.className = "stage-c";
			
			if (entry.hideable == true) {
				var showbutton = document.createElement("button");
				showbutton.setAttribute("onclick", "checkPic(this)");
				showbutton.innerHTML = "👁️";
				piccontrols.append(showbutton);
				pic.classList.add("hiddenpic");
			};
			
			var fullscreenbutton = document.createElement("button");
			fullscreenbutton.setAttribute("onclick", "checkPic(this); this.parentElement.nextElementSibling.requestFullscreen()");
			fullscreenbutton.innerHTML = "⛶";
			piccontrols.append(fullscreenbutton);
			
			container.append(piccontrols);			
			container.append(pic);
			break;

		case "video":
			if (entry.external == true) {
				var totalvideos = document.querySelectorAll(".mainvid").length;
				var vid = document.createElement("div");
				vid.setAttribute("document-stage", stageNumber);
				vid.setAttribute("document-entry", entryNumber);
				vid.className = "mainvid";
				videosList.push(entry.url.substr(-11));
				vid.id = "video" + totalvideos;
				container.append(vid);
				// vid.setAttribute("frameborder", "'0'");
				// vid.setAttribute("allow", "autoplay; encrypted-media");
				// vid.setAttribute("allowfullscreen", "");
			} else {
				var vid = document.createElement("video");
				vid.setAttribute("document-stage", stageNumber);
				vid.setAttribute("document-entry", entryNumber);
				vid.src = entry.url;
				vid.setAttribute("type", "video/mp4");
				vid.className = "mainvid";
				container.append(vid);
			};
			break;

		case "audio":
			if (entry.external == true) {
				var aud = document.createElement("iframe");
				aud.setAttribute("document-stage", stageNumber);
				aud.setAttribute("document-entry", entryNumber);
				aud.src = entry.url;
				aud.setAttribute("scrolling", "no");
				aud.setAttribute("frameborder", "no");
				aud.setAttribute("allow", "autoplay");
				aud.className = "mainaud";
				container.append(aud);
			} else {
				var aud = document.createElement("audio");
				aud.setAttribute("document-stage", stageNumber);
				aud.setAttribute("document-entry", entryNumber);
				aud.src = entry.url;
				aud.className = "mainaud";
				container.append(aud);
			};
			break;

		case "selection":
			var sel = document.createElement("div");
			sel.setAttribute("document-stage", stageNumber);
			sel.setAttribute("document-entry", entryNumber);
			sel.className = "select";
			container.append(sel);
			if (entry.random == true) {
				shuffle(entry.items);
			};
			for (question in entry.items) {
				var quescontainer = document.createElement("div");
				quescontainer.className = "question";
				var q = document.createElement("p");
				var opts = Array.from(entry.items[question].o);
				shuffle(opts);
				q.innerHTML = "<span class=\"n\">" + (parseInt([question]) + 1) + ". " + "</span>" + entry.items[question].q;
				quescontainer.append(q);
				for (option in opts) {
					var optcontainer = document.createElement("div");
					var opt = document.createElement("input");
					opt.setAttribute("type", "radio");
					opt.setAttribute("answer", entry.items[question].a);
					opt.setAttribute("onclick", "checkSel(this)");
					opt.id = "q_" + (parseInt([question]) + 1) + "_o_" + (parseInt([option]) + 1);
					opt.setAttribute("name", entry.items[question].q.replace(/[\u{1F300}-\u{1F5FF}|\u{1F1E6}-\u{1F1FF}|\u{2700}-\u{27BF}|\u{1F900}-\u{1F9FF}|\u{1F600}-\u{1F64F}|\u{1F680}-\u{1F6FF}|\u{2300}-\u{26FF}|\u{200d}|]{1,7}/ug, ""));
					var label = document.createElement("label");
					label.setAttribute("for", "q_" + (parseInt([question]) + 1) + "_o_" + (parseInt([option]) + 1));
					label.innerHTML = opts[option];
					optcontainer.append(opt, label);
					quescontainer.append(optcontainer);
				};
				sel.append(quescontainer);
			};
			break;

		case "multisel":
			var sel = document.createElement("div");
			sel.setAttribute("document-stage", stageNumber);
			sel.setAttribute("document-entry", entryNumber);
			sel.className = "multisel";
			container.append(sel);
			if (entry.random == true) {
				shuffle(entry.items);
			};
			for (question in entry.items) {
				var q = document.createElement("p");
				if (entry.numbers == true) {
					q.innerHTML = "<span class=\"n\">" + (parseInt([question]) + 1) + ". " + "</span>"
				};
				q.innerHTML += entry.items[question];
				q.innerHTML = q.innerHTML.replace(/\(/g, "(<span class=\"sel\">").replace(/\)/g, "</span>)")
				var selitems = q.querySelectorAll(".sel");
				for (selit = 0; selit < selitems.length; selit++) {
					var subitems = selitems[selit].innerHTML.split(" / ");
					selitems[selit].setAttribute("answer", subitems[0]);
					shuffle(subitems);
					selitems[selit].innerHTML = "";
					for (sbit in subitems) {
						selitems[selit].innerHTML += "<span onclick=\"checkMultisel(this)\">" + subitems[sbit] + "</span>" + " / ";
					};
					selitems[selit].innerHTML = selitems[selit].innerHTML.slice(0, selitems[selit].innerHTML.lastIndexOf(" / "));
				};
				sel.append(q);
				// sel.append(document.createElement("br"));
			}
			break;

		case "matching":
			var mat = document.createElement("div");
			mat.setAttribute("document-stage", stageNumber);
			mat.setAttribute("document-entry", entryNumber);
			mat.className = "mat";
			var table = document.createElement("table");

			var matcontrols = document.createElement("div");
			matcontrols.className = "stage-c";
			matcontrols.setAttribute("document-stage", stageNumber);
			var recyclebutton = document.createElement("button");
			recyclebutton.setAttribute("onclick", "cleanMatching(this)");
			recyclebutton.innerHTML = "♻";
			matcontrols.append(recyclebutton);
			container.append(matcontrols);

			var thead = table.createTHead();
			var tbody = table.createTBody();
			var hrow = thead.insertRow(-1);
			for (h in entry.headers) {
				var hcell = document.createElement("th");
				hcell.innerText = entry.headers[h];
				hrow.append(hcell);
				hcell.colSpan = 3;
			};
			//hrow.insertCell(1);

			var shuffled_l = shuffle(entry.items.l.slice());
			var shuffled_r = shuffle(entry.items.r.slice());
			for (item in entry.items.l) {
				var brow = tbody.insertRow(-1);
				var bcell1 = brow.insertCell(-1);
				bcell1.colSpan = 2;
				bcell1.setAttribute("onclick", "checkMatching(this)");
				bcell1.className = "l-side";
				if (shuffled_l[item].includes("//")) {
					bcell1.innerHTML = "<span class=\"n\">" + (parseInt([item]) + 1) + ". " + "</span>" + "<img src=\"" + shuffled_l[item] + "\"></img>";
				} else {
					bcell1.innerHTML = "<span class=\"n\">" + (parseInt([item]) + 1) + ". " + "</span>" + shuffled_l[item];
				};
				bcell1.setAttribute("index", entry.items.l.findIndex(query => query == shuffled_l[item]));
				var bcell3 = brow.insertCell(-1);
				bcell3.colSpan = 2;
				bcell3.setAttribute("onclick", "checkMatching(this)");
				bcell3.className = "r-side";
				if (shuffled_r[item].includes("//")) {
					bcell3.innerHTML = "<span class=\"n\">" + String.fromCharCode(parseInt([item]) + 97) + ". " + "</span>" + "<img src=\"" + shuffled_r[item] + "\"></img>";
				} else {
					bcell3.innerHTML = "<span class=\"n\">" + String.fromCharCode(parseInt([item]) + 97) + ". " + "</span>" + shuffled_r[item];
				};
				bcell3.setAttribute("index", entry.items.r.findIndex(query => query == shuffled_r[item]));
				if (item == 0) {
					var matchArea = brow.insertCell(1);
					matchArea.rowSpan = entry.items.l.length;
					matchArea.colSpan = 2;
					matchArea.className = "match-area";
					matchArea.setAttribute("onclick", "clearCells(this)");
					continue;
				};
			}
			mat.append(table);
			container.append(mat);
			var svgcanvas = document.createElementNS(xmlns, "svg");
			svgcanvas.setAttributeNS(null, "height", "100%");
			svgcanvas.setAttributeNS(null, "width", "100%");
			mat.insertBefore(svgcanvas, table);
			break;

		case "gapfill":
			var textcontainer = document.createElement("div");
			textcontainer.setAttribute("document-stage", stageNumber);
			textcontainer.setAttribute("document-entry", entryNumber);
			var text = document.createElement("p");
			text.className = "gapfill";

			var raw_text = entry.text;
			//for (item in entry.items) {
			raw_text = raw_text.replace(/{/g, "<span class=\"width-setter\"></span><input spellcheck=\"false\" autocapitalize=\"none\" oninput=\"checkGap(this); this.previousElementSibling.innerHTML = this.value.replace(/</g, 'm'); this.style.width = this.previousElementSibling.offsetWidth + 'px'\" class=\"gap\" answer=\"").replace(/}/g, "\"><span class\"checkcontainer\"></span>").replace(/\|/g, "<br>");
			//};
			text.innerHTML = raw_text;
			textcontainer.append(text);

			if (entry.box == true) {
				var box = document.createElement("div");
				var gaps = textcontainer.querySelectorAll("input.gap");
				var items = [];
				for (it = 0; it < gaps.length; it++) {
					items[it] = gaps[it].getAttribute("answer");
				};
				box.setAttribute("document-stage", stageNumber);
				box.setAttribute("document-entry", entryNumber);
				var shuffled_items = shuffle(items.slice());
				box.className = "box";
				for (it = 0; it < gaps.length; it++) {
					var span = document.createElement("span");
					span.setAttribute("onclick", "this.classList.toggle('struck')");
					span.setAttribute("ondragend", "this.classList.toggle('struck'); document.getSelection().removeAllRanges()");
					span.className = "boxitem";
					span.innerHTML = shuffled_items[it];
					box.append(span);
					box.innerHTML += "<span> • </span>";
				};
				box.lastElementChild.remove();
				container.append(box);
			};

			container.append(textcontainer);
			for (gap of text.querySelectorAll("span")) {
				if (!gap.previousSibling || gap.previousSibling.textContent.charAt(gap.previousSibling.textContent.length - 2) == ".") {
					gap.setAttribute("answer", gap.getAttribute("answer").charAt(0).toUpperCase() + gap.getAttribute("answer").slice(1));
				};
			};
			break;
		case "completion":
			var comp = document.createElement("div");
			comp.setAttribute("document-stage", stageNumber);
			comp.setAttribute("document-entry", entryNumber);
			comp.className = "comp";
			if (entry.random == true) {
				shuffle(entry.items);
			};

			for (item in entry.items) {
				var q = document.createElement("p");
				var clues = [];
				for (clue in entry.items[item].c) {
					clues.push(entry.items[item].c[clue]);
				};
				var raw_question = entry.items[item].q;

				raw_question = raw_question.replace(/{/g, "<span class=\"width-setter\"></span><input spellcheck=\"false\" autocapitalize=\"none\" oninput=\"checkGap(this); this.previousElementSibling.innerHTML = this.value.replace(/</g, 'm'); this.style.width = this.previousElementSibling.offsetWidth + 'px'\" class=\"gap\" answer=\"").replace(/}/g, "\"><span class=\"checkcontainer\"></span>");

				q.innerHTML = "<span class='n'>" + (parseInt([item]) + 1) + ". " + "</span>" +
					raw_question

				if (entry.clues == true) {
					q.innerHTML += " (" + clues.join(", ") + ")";
				};
				comp.append(q);
			};
			container.append(comp);
			for (gap of comp.querySelectorAll("input.gap")) {
				if (!gap.previousSibling || gap.previousSibling.textContent.charAt(gap.previousSibling.textContent.length - 2) == ".") {
					gap.setAttribute("answer", gap.getAttribute("answer").charAt(0).toUpperCase() + gap.getAttribute("answer").slice(1));
				};
			};
			break;

		case "unscrambling":
			var unsc = document.createElement("div");
			unsc.setAttribute("document-stage", stageNumber);
			unsc.setAttribute("document-entry", entryNumber);
			unsc.className = "unsc";

			if (entry.random == true) {
				shuffle(entry.items);
			};
			for (item = 0; item < entry.items.length; item++) {
				var q = document.createElement("p");
				var answer = entry.items[item].replace(/\//g, " ");
				answer = answer.charAt(0).toUpperCase() + answer.slice(1);
				if (answer.endsWith("!") || answer.endsWith("?") || answer.endsWith(".")) {
					answer = answer.split("");
					delete answer[answer.length - 2];
					answer = answer.join("");
				} else {
					answer = answer.concat(".");
				};
				if (!answer.startsWith("I ")) {
					entry.items[item] = entry.items[item].charAt(0).toLowerCase() + entry.items[item].slice(1);
				};
				var shuffled_q = shuffle(entry.items[item].split("/"));
				q.innerHTML = "<span class=\"n\">" + (parseInt([item]) + 1) +
					". " + "</span><span class=\"width-setter\"></span><input spellcheck=\"false\" autocapitalize=\"none\" oninput=\"checkUnscrambling(this); this.previousElementSibling.innerHTML = this.value.replace(/</g, 'm'); this.style.width = this.previousElementSibling.offsetWidth + 'px'\" class=\"scramble\" oninput=\"checkUnscrambling(this)\" answer=\"" +
					answer + "\"><span class=\"checkcontainer\"></span>" +
					" (" + shuffled_q.join(" / ") + ")";
				unsc.append(q);
			};
			container.append(unsc);
			break;

		case "essay":
			var essy = document.createElement("div");
			essy.setAttribute("document-stage", stageNumber);
			essy.setAttribute("document-entry", entryNumber);
			essy.className = "unsc";
			for (item in entry.items) {
				var q = document.createElement("p");
				q.innerHTML = "<span class=\"n\">" + (parseInt([item]) + 1) + ". </span>" + entry.items[item].q +
					"<br><textarea spellcheck=\"false\" rows=\"1\" autocapitalize=\"none\" autocorrect=\"off\" class=\"essay\" oninput=\"checkEssay(this); this.style.height = '1px'; this.style.minHeight = '1px'; this.style.height = this.scrollHeight + 'px'; this.style.minHeight = this.scrollHeight + 'px'\" answer=\"" +
					entry.items[item].a.join("\n") + "\">"
				essy.append(q);
			};
			container.append(essy);
			break;
		case "checking":
			var chck = document.createElement("div");
			chck.setAttribute("document-stage", stageNumber);
			chck.setAttribute("document-entry", entryNumber);
			chck.className = "chck";
			var table = document.createElement("table");
			var thead = table.createTHead(-1);
			var tbody = table.createTBody(-1);
			chck.append(table);
			container.append(chck);
			var hrow = thead.insertRow(-1);
			for (h in entry.headers) {
				var hcell = document.createElement("th");
				hcell.innerText = entry.headers[h];
				hrow.append(hcell);
				if (h == 0) {
					hcell.colSpan = 1;
				} else if (h == 1) {
					hcell.colSpan = entry.categories.length;
				};
			};
			var secondrow = tbody.insertRow(-1);
			var weirdcell = secondrow.insertCell(-1);
			weirdcell.className = "itemcell empty";
			for (cat in entry.categories) {
				var catcell = secondrow.insertCell(-1);
				var span = document.createElement("span");
				span.innerHTML = entry.categories[cat];
				catcell.append(span);
				if (entry.categories.length > 6) {
					catcell.className = "catcell tight";
				} else {
					catcell.className = "catcell";
				};
			};
			if (entry.random == true) {
				shuffle(entry.items);
			};
			for (item in entry.items) {
				var brow = tbody.insertRow(-1);
				var itemcell = brow.insertCell(-1);
				itemcell.className = "itemcell";
				var itemName = document.createElement("span");
				itemName.innerHTML = entry.items[item].n;
				itemName.setAttribute("answer", entry.items[item].c);
				itemcell.append(itemName);
				for (cat in entry.categories) {
					var checkcell = brow.insertCell(-1);
					checkcell.className = "checkcell";
					checkcell.innerHTML = "<input type=\"checkbox\" onchange=\"checkChecking(this)\">"
				};
			};
			break;

		case "flashcards":
			var flsh = document.createElement("div");
			flsh.setAttribute("document-stage", stageNumber);
			flsh.setAttribute("document-entry", entryNumber);
			flsh.className = "flsh";
			if (entry.random == true) {
				shuffle(entry.items);
			};
			for (item in entry.items) {
				var flashcard = document.createElement("div");
				flashcard.className = "flashcard";
				var mean = document.createElement("img");
				mean.setAttribute("onclick", "flipFlashCard(this)")
				var form = document.createElement("span");
				form.className = "form";
				var pron = document.createElement("span");
				pron.setAttribute("onclick", "sayWord(this)");
				pron.className = "pron";
				var pos = document.createElement("span");
				pos.className = "pos";
				var aud = document.createElement("audio");
				aud.src = entry.items[item].p.aud;
				//flashcard.style.backgroundImage = "url(" + entry.items[item].m + ")";

				mean.src = entry.items[item].m;
				pron.innerHTML = "/" + entry.items[item].p.ipa + "/";
				var syllables = entry.items[item].f.w.split("|");
				for (s in syllables) {
					if (syllables[s].charAt(0) != "'") {
						form.innerHTML += "<span class=\"syll\">" + syllables[s] + "</span>";
					} else {
						form.innerHTML += "<span class=\"syll-p\">" + syllables[s].slice(1) + "</span>";
					};
					form.innerHTML += "<span class=\"sep\">‧</span>";
				}
				form.lastElementChild.remove();
				pos.innerHTML = entry.items[item].f.pos;

				flashcard.append(mean, pron, form, pos, aud);
				flsh.append(flashcard);
			};
			container.append(flsh);
			break;
		case "naming":
			if (entry.box == true) {
				var box = document.createElement("div");
				box.setAttribute("document-stage", stageNumber);
				box.setAttribute("document-entry", entryNumber);
				var itemsarray = [];
				for (item in entry.items) {
					itemsarray[item] = entry.items[item].name;
				};
				var shuffled_items = shuffle(itemsarray);
				box.className = "box";
				for (item in entry.items) {
					var span = document.createElement("span");
					span.className = "boxitem";
					span.setAttribute("onclick", "this.classList.toggle('struck')");
					span.setAttribute("ondragend", "this.classList.toggle('struck'); document.getSelection().removeAllRanges()");
					span.innerHTML = shuffled_items[item];
					box.append(span);
					box.innerHTML += "<span> • </span>";
				};
				box.lastElementChild.remove();
				container.append(box);
			};
			if (entry.random == true) {
				shuffle(entry.items);
			};
			var naming = document.createElement("div");
			naming.setAttribute("document-stage", stageNumber);
			naming.setAttribute("document-entry", entryNumber);
			naming.className = "namg";
			for (item in entry.items) {
				var itemContainer = document.createElement("div");
				itemContainer.className = "namg-item";
				var itemPicture = document.createElement("img");
				itemPicture.src = entry.items[item].pic;
				itemContainer.append(itemPicture);
				itemContainer.innerHTML += "<br><span class=\"n\">" + (parseInt([item]) + 1) + ". </span><span class=\"width-setter\"></span><input spellcheck=\"false\" autocapitalize=\"none\" oninput=\"checkGap(this); this.previousElementSibling.innerHTML = this.value.replace(/</g, 'm'); this.style.width = this.previousElementSibling.offsetWidth + 'px'\" class=\"gap\" answer=\"" +
					entry.items[item].name + "\"><span class\"checkcontainer\"></span>";
				naming.append(itemContainer);
			};
			container.append(naming);
			break;
		case "conversation":
			var convcontrols = document.createElement("div");
			convcontrols.setAttribute("document-stage", stageNumber);
			convcontrols.setAttribute("document-entry", entryNumber);
			convcontrols.className = "stage-c";
			var showbutton = document.createElement("button");
			showbutton.setAttribute("onclick", "showHideConv(this)");
			showbutton.innerHTML = "👁️";
			convcontrols.append(showbutton);
			container.append(convcontrols);

			var convContainer = document.createElement("div");
			convContainer.setAttribute("document-stage", stageNumber);
			convContainer.setAttribute("document-entry", entryNumber);
			convContainer.className = "conv";
			var convPic = document.createElement("img");
			convPic.src = entry.pic;
			convPic.className = "convo";
			var convAudio = document.createElement("audio");
			convAudio.setAttribute("document-stage", stageNumber);
			convAudio.setAttribute("document-entry", entryNumber);
			convAudio.src = entry.audio;
			convAudio.setAttribute("controls", "");
			convAudio.onended = function () {
				this.parentElement.previousSibling.classList.add("right")
			};
			var linesContainer = document.createElement("div");
			linesContainer.className = "lines";
			convContainer.append(convPic, convAudio, linesContainer);
			for (line in entry.lines) {
				var convLine = document.createElement("p");
				if (entry.lines[line].char != "separator") {
					//convLine.innerHTML = entry.characters.find(char => char.name == entry.lines[line].char).icon;
					convLine.innerHTML = "<span class=\"n\">" + entry.lines[line].char + ": </span>";
					convLine.innerHTML += entry.lines[line].text;
				} else if (entry.lines[line].char == "separator" && entry.lines[line].text) {
					convLine.innerHTML = "〜 " + entry.lines[line].text + " 〜";
					convLine.style.textAlign = "center";
				} else {
					convLine.innerHTML = "· · ·";
					convLine.style.textAlign = "center";
				};
				convLine.setAttribute("onclick", "dimConvo(this)");
				convLine.className = "dim";
				convLine.setAttribute("character", entry.lines[line].char);
				linesContainer.append(convLine);
			};
			container.append(convContainer);
			break;
		case "memory":
			var cardcontainer = document.createElement("div");
			cardcontainer.setAttribute("document-stage", stageNumber);
			cardcontainer.setAttribute("document-entry", entryNumber);
			cardcontainer.className = "memory";
			var group_a = [];
			var group_b = [];
			for (cd = 0; cd < entry.group_a.length; cd++) {
				group_a[cd] = {
					item: entry.group_a[cd],
					index: cd
				};
			};
			for (cd = 0; cd < entry.group_b.length; cd++) {
				group_b[cd] = {
					item: entry.group_b[cd],
					index: cd
				};
			};

			var allcards = group_a.concat(group_b);
			shuffle(allcards);

			for (cd = 0; cd < allcards.length; cd++) {
				var card = document.createElement("div");
				card.className = "memcard";
				var cardfront = document.createElement("div");
				cardfront.className = "cardfront";
				var cardback = document.createElement("div");
				cardback.className = "cardback";
				card.append(cardback, cardfront);
				if (allcards[cd].item.includes("//") || allcards[cd].item.includes("http")) {
					cardfront.innerHTML = "<div class=\"mempic-container\"><div class=\"mempic\" style=\"background-image: url(" + allcards[cd].item + ");\"></div></div>";
					imgpreload(allcards[cd].item);
				} else if (allcards[cd].item.length < 3) {
					cardfront.innerHTML = "<span class=\"memoji\">" + allcards[cd].item + "</span>";
				} else if (allcards[cd].item.split(" ").length < 4) {
					cardfront.innerHTML = "<span class=\"memword\">" + allcards[cd].item.replace(/\|/g, "&shy;") + "</span>";
				} else if (allcards[cd].item.split(" ").length > 4) {
					cardfront.innerHTML = "<span class=\"memdef\">" + allcards[cd].item + "</span>";
				}
				var cardno = document.createElement("span");
				cardno.className = "fcardno";
				card.append(cardno);
				card.setAttribute("index", allcards[cd].index);
				card.setAttribute("onclick", "checkMemory(this)");
				cardcontainer.append(card);
			};
			container.append(cardcontainer);
			break;
		case "target-language":
			var languagebox = document.createElement("div");
			languagebox.setAttribute("document-stage", stageNumber);
			languagebox.setAttribute("document-entry", entryNumber);
			languagebox.className = "target-language";
			var languagebanner = document.createElement("div");
			languagebanner.className = "tl-banner";
			var languagepic1 = document.createElement("img");
			languagepic1.className = "tl-pic"
			languagepic1.src = "asa-header-logo.png";
			var languagetitle = document.createElement("h2")
			languagetitle.className = "tl-title";
			languagetitle.innerHTML = entry.title;
			var languagepic2 = document.createElement("img");
			languagepic2.className = "tl-pic"
			languagepic2.src = "asa-header-logo.png";
			languagepic2.setAttribute("style", "transform:rotateX(180)");
			languagebanner.append(languagepic1, languagetitle, languagepic2);
			languagebox.append(languagebanner)
			var elems = entry.elems;
			for (e in elems) {
				switch (entry.elems[e].type) {
					case "instruction":
						var instruction = document.createElement("p");
						instruction.className = "tl-instr";
						instruction.innerHTML = "⯈ ";
						instruction.innerHTML += entry.elems[e].content;
						languagebox.append(instruction);
						break;
					case "prompt":
						var prompt = document.createElement("p");
						prompt.className = "tl-prompt";
						prompt.innerHTML = entry.elems[e].content;
						languagebox.append(prompt);
						break;
					case "heading":
						var heading = document.createElement("h3");
						heading.className = "tl-heading";
						heading.innerHTML = entry.elems[e].content;
						languagebox.append(heading);
						break;
					case "exponents":
						var expo = document.createElement("div");
						expo.className = "exponents";
						for (exponent in entry.elems[e].content) {
							var exspan = document.createElement("p");
							exspan.className = "expo";
							exspan.innerHTML = entry.elems[e].content[exponent].replace(/{/g, "<span class=\"width-setter\"></span><input spellcheck=\"false\" autocapitalize=\"none\" oninput=\"checkGap(this); this.previousElementSibling.innerHTML = this.value.replace(/</g, 'm'); this.style.width = this.previousElementSibling.offsetWidth + 'px'\" class=\"gap\" answer=\"").replace(/}/g, "\"><span class=\"checkcontainer\"></span>");
							expo.append(exspan);
						};
						languagebox.append(expo);
						break;
					case "ccqs":
						var ccqcontainer = document.createElement("div");
						for (qu in entry.elems[e].ccqs) {
							var ccq = document.createElement("div");
							ccq.className = "ccq";
							var question = document.createElement("p");
							shuffle(entry.elems[e].ccqs[qu].o);
							question.innerHTML = entry.elems[e].ccqs[qu].q;
							ccq.append(question);
							for (option in entry.elems[e].ccqs[qu].o) {
								var optcontainer = document.createElement("div");
								optcontainer.className = "ccqopt"
								var opt = document.createElement("input");
								opt.setAttribute("type", "radio");
								opt.setAttribute("answer", entry.elems[e].ccqs[qu].a);
								opt.setAttribute("onclick", "checkSel(this)");
								opt.id = "ccq_" + (parseInt([option]) + 1) + "_o_" + (parseInt([option]) + 1);
								opt.setAttribute("name", entry.elems[e].ccqs[qu].q.replace(/[\u{1F300}-\u{1F5FF}|\u{1F1E6}-\u{1F1FF}|\u{2700}-\u{27BF}|\u{1F900}-\u{1F9FF}|\u{1F600}-\u{1F64F}|\u{1F680}-\u{1F6FF}|\u{2300}-\u{26FF}|\u{200d}|]{1,7}/ug, ""));
								var label = document.createElement("label");
								label.setAttribute("for", "ccq_" + (parseInt([option]) + 1) + "_o_" + (parseInt([option]) + 1));
								label.innerHTML = entry.elems[e].ccqs[qu].o[option];
								optcontainer.append(opt, label);
								ccq.append(optcontainer);
								//console.log(ccq)
							}
							ccqcontainer.append(ccq);
						}
						languagebox.append(ccqcontainer);
						break;
					case "structure":
						var box = document.createElement("div");
						box.className = "box";
						var boxitems = Array.from(entry.elems[e].struct);

						shuffle(boxitems);

						for (part in entry.elems[e].struct) {
							box.innerHTML += "<span onclick=\"this.classList.toggle('struck')\" ondragend=\"this.classList.toggle('struck'); document.getSelection().removeAllRanges()\">" + boxitems[part] + "</span>";
							box.innerHTML += "<span> • </span>";
						};
						box.lastElementChild.remove();

						var structtable = document.createElement("table");
						structtable.className = "struct";

						for (exponent in entry.elems[e].exp) {
							var exprow = structtable.insertRow(-1);
							var emptycell = exprow.insertCell(-1);
							for (part in entry.elems[e].exp[0]) {
								var expcell = exprow.insertCell(-1);
								expcell.innerHTML = entry.elems[e].exp[exponent][part];

							};
						};

						var lastrow = structtable.insertRow(-1);
						lastrow.className = "n";
						var speccell = lastrow.insertCell(-1);
						speccell.innerHTML = entry.elems[e].spec;
						for (part in entry.elems[e].struct) {

							var structcell = lastrow.insertCell(-1);
							structcell.innerHTML = "<div class=\"plus\">+</div><span class=\"width-setter\"></span><input spellcheck=\"false\" autocapitalize=\"none\" oninput=\"checkGap(this); this.previousElementSibling.innerHTML = this.value.replace(/</g, 'm'); this.style.width = this.previousElementSibling.offsetWidth + 'px'\" class=\"gap\" answer=\"" +
								entry.elems[e].struct[part] + "\"><span class\"checkcontainer\"></span>";
						};
						lastrow.querySelectorAll(".plus")[lastrow.querySelectorAll(".plus").length - 1].remove();


						languagebox.append(box, structtable);
						break;
					case "phonology":
						var phoncontainer = document.createElement("div");
						phoncontainer.className = "phon";
						var feature = document.createElement("span");
						feature.className = "feature";
						feature.innerHTML = entry.elems[e].feature;
						var detailscontainer = document.createElement("div");
						var description = document.createElement("p");
						description.innerHTML = entry.elems[e].desc;
						var exponents = document.createElement("div");
						exponents.className = "exponents";
						for (exp = 0; exp < entry.elems[e].exp.length; exp++) {
							exponents.innerHTML += "<span onclick=\"sayWord(this)\" class=\"exp\">" + entry.elems[e].exp[exp].form.replace(/{/g, "<span class=\"n\">").replace(/}/g, "</span>") +
								"<audio src=\"" + entry.elems[e].exp[exp].pron + "\">" + "</span>";
						};
						detailscontainer.append(description, exponents);
						phoncontainer.append(feature, detailscontainer);
						languagebox.append(phoncontainer);
						break;
					case "picking":
						var pickcontainer = document.createElement("div");
						pickcontainer.className = "pick";
						var pickitems = Array.from(entry.elems[e].content);
						for (it = 0; it < pickitems.length; it++) {
							pickitem = pickitems[it];

							textarray = pickitem.split("|");
							for (s in textarray) {
								if (!textarray[s].includes("*")) {
									textarray[s] = "<span onclick=\"checkPick(this)\" pick=\"wrong\">" + textarray[s] + "</span>";
								} else {
									textarray[s] = "<span onclick=\"checkPick(this)\" pick=\"right\">" + textarray[s].replace("*", "") + "</span>";
								};
							};
							pickcontainer.innerHTML += "<span class=\"pickitem\">" + textarray.join("") + "</span>";
						};
						languagebox.append(pickcontainer);
						break;
				};
			};
			container.append(languagebox);
			break;
		case "picking":
			var pickcontainer = document.createElement("div");
			pickcontainer.className = "pick";
			pickcontainer.setAttribute("document-stage", stageNumber);
			pickcontainer.setAttribute("document-entry", entryNumber);
			var pickitems = Array.from(entry.content);
			if (entry.random == true) {
				shuffle(pickitems);
			};
			for (it = 0; it < entry.content.length; it++) {
				pickitem = pickitems[it];

				textarray = pickitem.split("|");
				for (s in textarray) {
					if (!textarray[s].includes("*")) {
						textarray[s] = "<span onclick=\"checkPick(this)\" pick=\"wrong\">" + textarray[s] + "</span>";
					} else {
						textarray[s] = "<span onclick=\"checkPick(this)\" pick=\"right\">" + textarray[s].replace("*", "") + "</span>";
					};
				};
				if (entry.numbers == true) {
					pickcontainer.innerHTML += "<span class=\"n\">" + (it + 1) + ". </span>";
				};
				pickcontainer.innerHTML += "<span class=\"pickitem\">" + textarray.join("") + "</span><br>";
			};
			container.append(pickcontainer);
			break;
		case "sorting":
			var sortingcontainer = document.createElement("div");
			sortingcontainer.setAttribute("document-stage", stageNumber);
			sortingcontainer.setAttribute("document-entry", entryNumber);
			sortingcontainer.className = "sort";
			var box = document.createElement("div");
			box.setAttribute("document-stage", stageNumber);
			box.setAttribute("document-entry", entryNumber);
			var itemsarray = [];
			for (cat = 0; cat < entry.categories.length; cat++) {
				itemsarray = itemsarray.concat(entry.categories[cat].items);
			};
			var shuffled_items = shuffle(itemsarray);
			if (entry.box == true) {
				box.className = "box";
				for (item in itemsarray) {
					var span = document.createElement("span");
					span.className = "boxitem";
					span.setAttribute("onclick", "this.classList.toggle('struck')");
					span.setAttribute("ondragend", "this.classList.toggle('struck'); document.getSelection().removeAllRanges()");
					span.innerHTML = itemsarray[item];
					box.append(span);
					box.innerHTML += "<span> • </span>";
				};
				box.lastElementChild.remove();
			};

			var table = document.createElement("table");
			var thead = table.createTHead();
			var headers = thead.insertRow(-1);
			var tbody = table.createTBody();
			var contentrow = tbody.insertRow(-1);
			for (cat = 0; cat < entry.categories.length; cat++) {
				var headercell = document.createElement("th");
				//var permutations = memPermut(entry.categories[cat].items);
				//console.log(permutations)
				headercell.innerHTML = "<span>" + entry.categories[cat].name + "</span>";
				//headercell.setAttribute("items", permutations.replace(/,/g, "\n"));
				headercell.setAttribute("items", entry.categories[cat].items.join("\n") + "\n");
				headers.append(headercell);
				var contentcell = contentrow.insertCell(-1);
				var span = document.createElement("textarea");
				span.className = "sorting";
				span.setAttribute("oninput", "checkSorting(this); this.style.height = '1px'; this.style.minHeight = '1px'; this.style.height = this.scrollHeight + 'px'; this.style.minHeight = this.scrollHeight + 'px'");
				span.setAttribute("contenteditable", "");
				span.setAttribute("spellcheck", "false");
				span.setAttribute("rows", entry.categories[cat].items.length);
				span.setAttribute("autocapitalize", "none");
				var checkcontainer = document.createElement("span");
				checkcontainer.className = "checkcontainer"; 
				contentcell.append(span, checkcontainer);

			};

			sortingcontainer.append(table);
			container.append(box);
			container.append(sortingcontainer);
			break;
		case "scratchpad":
			var scratcharea = document.createElement("div");
			scratcharea.setAttribute("document-stage", stageNumber);
			scratcharea.setAttribute("document-entry", entryNumber);
			scratcharea.className = "scratcharea";
			var scratchlabel = document.createElement("span");
			scratchlabel.innerHTML = "🗒";
			var scratchpad = document.createElement("textarea");
			scratchpad.className = "scratch";
			scratchpad.setAttribute("contenteditable", "");
			scratchpad.setAttribute("spellcheck", "false");
			scratchpad.setAttribute("autocapitalize", "none");
			scratchpad.setAttribute("oninput", "this.style.height = '1px'; this.style.minHeight = '1px'; this.style.height = this.scrollHeight + 'px'; this.style.minHeight = this.scrollHeight + 'px'");
			container.append(scratcharea);
			scratcharea.append(scratchlabel, scratchpad);
			break;
		case "visual-novel":
			var novel = document.createElement("div");
			novel.className = "novel";
			novel.setAttribute("document-stage", stageNumber);
			novel.setAttribute("document-entry", entryNumber);
			novel.setAttribute("scene", 0);
			novel.setAttribute("line", 0);
			novel.setAttribute("onclick", "advance(this)");
			var retreatButton = document.createElement("div");
			retreatButton.setAttribute("onclick", "retreat(this)");
			retreatButton.className = "retreat";
			retreatButton.innerHTML = "◀";
			novel.append(retreatButton);
			var exitFSbutton = document.createElement("div");
			exitFSbutton.setAttribute("onclick", "event.stopPropagation(); this.style.display = 'none'; document.exitFullscreen()");
			exitFSbutton.className = "exit-fs";
			exitFSbutton.innerHTML = "❌";
			novel.append(exitFSbutton);
			var vncontrols = document.createElement("div");
			vncontrols.setAttribute("document-stage", stageNumber);
			vncontrols.setAttribute("document-entry", entryNumber);
			vncontrols.className = "stage-c";
			var fullscreenbutton = document.createElement("button");
			fullscreenbutton.setAttribute("onclick", "this.parentElement.nextElementSibling.children[1].style.display = 'block'; \
				this.parentElement.nextElementSibling.requestFullscreen()");
			fullscreenbutton.innerHTML = "⛶";
			vncontrols.append(fullscreenbutton);
			container.append(vncontrols);
			container.append(novel);
			for (scn in entry.script) {
				imgpreload(entry.script[scn].background);
				for (chr in entry.script[scn].characters) {
					imgpreload(entry.script[scn].characters[chr].pic);
				}
			};
			break;
		case "random-gen":
			var subtype = entry.subtype;
			var gencontainer = document.createElement("div");
			gencontainer.className = "random-gen" ;
			gencontainer.setAttribute("document-stage", stageNumber);
			gencontainer.setAttribute("document-entry", entryNumber);
			gencontainer.setAttribute("subtype", subtype);
			switch (subtype) {
				case "array":
					if (entry.prefix != "") {
						var prefixcontainer = document.createElement("span");
						prefixcontainer.innerHTML = entry.prefix;
						prefixcontainer.classname = "morpheme";
						gencontainer.append(prefixcontainer);
					};
					for (ii = 0; ii < entry.slots.length; ii++) {
						var slotDisp = document.createElement("div");
						slotDisp.className = "slot";
						slotDisp.innerHTML = "-";
						gencontainer.append(slotDisp);
					};
					if (entry.suffix != "") {
						var suffixcontainer = document.createElement("span");
						suffixcontainer.innerHTML = entry.suffix;
						suffixcontainer.classname = "morpheme";
						gencontainer.append(suffixcontainer);
					};
					var randombutton = document.createElement("button");
					randombutton.className = "random-b";
					randombutton.innerHTML= "🎰";
					randombutton.setAttribute("onclick", "randomG(this)");
					gencontainer.append(randombutton);
					break;
				case "number":
					if (entry.prefix != "") {
						var prefixcontainer = document.createElement("span");
						prefixcontainer.innerHTML = entry.prefix;
						prefixcontainer.classname = "morpheme";
						gencontainer.append(prefixcontainer);
					};
					var numberDisp = document.createElement("div");
					numberDisp.className = "slot";
					numberDisp.innerHTML = "-";
					gencontainer.append(numberDisp);
					if (entry.suffix != "") {
						var suffixcontainer = document.createElement("span");
						suffixcontainer.innerHTML = entry.suffix;
						suffixcontainer.classname = "morpheme";
						gencontainer.append(suffixcontainer);
					};
					var randombutton = document.createElement("button");
					randombutton.className = "random-b";
					randombutton.innerHTML= "#️⃣";
					randombutton.setAttribute("onclick", "randomG(this)");
					gencontainer.append(randombutton);
					break;
				case "madlibs":
					var fixedDisplay = document.createElement("span");
					fixedDisplay.innerHTML = entry.fixed.replace(/{/g, "<span class=\"madlib\" slot=\"").replace(/}/g, "\">-</span>");
					gencontainer.append(fixedDisplay);
					var randombutton = document.createElement("button");
					randombutton.className = "random-b";
					randombutton.innerHTML= "🎲";
					randombutton.setAttribute("onclick", "randomG(this)");
					gencontainer.append(randombutton);
					break;
				case "dice":
					var diceNumber = document.createElement("input");
					diceNumber.setAttribute("type", "number");
					diceNumber.setAttribute("min", "1");
					diceNumber.setAttribute("max", "100");
					diceNumber.setAttribute("value", "1");
					gencontainer.append(diceNumber);
					var diceType = document.createElement("select");
					diceType.innerHTML = "<option value=\"2\">d2</option><option value=\"4\">d4</option><option value=\"6\">d6</option>\
					<option value=\"8\">d8</option><option value=\"10\">d10</option><option value=\"12\">d12</option>\
					<option value=\"20\" selected>d20</option><option value=\"100\">d100</option>";
					gencontainer.append(diceType);
					var diceMod = document.createElement("select");
					diceMod.innerHTML = "<option selected value=\"1\">+</option><option value=\"-1\">-</option>";
					gencontainer.append(diceMod);
					var diceNumber = document.createElement("input");
					diceNumber.setAttribute("type", "number");
					diceNumber.setAttribute("min", "0");
					diceNumber.setAttribute("max", "100");
					diceNumber.setAttribute("value", "0");
					gencontainer.append(diceNumber);
					gencontainer.innerHTML += "<span> = </span>";
					var resultDisplay = document.createElement("span");
					resultDisplay.className = "slot";
					resultDisplay.innerHTML = "-";
					gencontainer.append(resultDisplay);
					var randombutton = document.createElement("button");
					randombutton.className = "random-b";
					randombutton.innerHTML= "🎲";
					randombutton.setAttribute("onclick", "randomG(this)");
					gencontainer.append(randombutton);
					break;
			};
			container.append(gencontainer);
			break;
	};
	if (entry.source) {
		var source = document.createElement("span");
		source.setAttribute("document-stage", stageNumber);
		source.setAttribute("document-entry", entryNumber);
		source.className = "source";
		source.innerHTML = "📚 " + entry.source;
		container.append(source);
	};
	if (teacherMode == true) {
		var teacherbutton = document.createElement("button");
		teacherbutton.innerHTML = "✏️";
		teacherbutton.className = "t-button";
		teacherbutton.setAttribute("document-stage", stageNumber);
		teacherbutton.setAttribute("document-entry", entryNumber);
		teacherbutton.setAttribute("onclick", "this.nextElementSibling.classList.toggle(\"shown\")");
		var teacherbubble = document.createElement("div");
		teacherbubble.className = "t-bubble";
		var bubbletext = entry.teacher
		if (entry.teacher == undefined) {
			bubbletext = "";
		};
		var bubblearray = bubbletext.split("|");
		for (el in bubblearray) {
			if(bubblearray[el].includes("//")) {
				bubblearray[el] = "<img src=\"" + bubblearray[el] + "\">";
			}
			if(bubblearray[el].includes(":") && !bubblearray[el].includes("//")) {
				bubblearray[el] = bubblearray[el].split(":")
				bubblearray[el] = "<p><span class=\"n\">" + bubblearray[el][0] + ":</span>" + " " + "<span>" +bubblearray[el][1] + "</span></p>";
			}
			if(bubblearray[el].trim().includes("-") && (!bubblearray[el].includes("//") || (!bubblearray[el].includes(":")))) {
				bubblearray[el] = "<li>" + bubblearray[el].trim().replace("-", "") + "</li>";
			}
		}
		
		
		bubbletext = bubblearray.join("").replace(/(<\/li><br><li>)/g, "</li><li>").replace(/(?<!<\/li>)(<li>)/g,"<ul><li>").replace(/(<\/li>)(?!<li>)/g, "</li></ul>"); 
		teacherbubble.innerHTML = bubbletext
		teacherbubble.setAttribute("document-stage", stageNumber);
		teacherbubble.setAttribute("document-entry", entryNumber);
		container.append(teacherbutton, teacherbubble);
	}
};


///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////


function checkSel(item) {
	var others = Array.from(document.getElementsByName(item.name));
	for (other of others) {
		var label = other.parentElement.lastChild;
		label.classList.remove("right");
		label.classList.remove("wrong");
	};
	if (item.parentNode.lastChild.innerHTML == item.getAttribute("answer")) {
		item.parentNode.lastChild.classList.add("right");
	} else {
		item.parentNode.lastChild.classList.add("wrong");
	};

	var total = item.parentElement.parentElement.parentElement.childElementCount;
	var right = item.parentElement.parentElement.parentElement.querySelectorAll(".right").length
	var instruction = item.parentElement.parentElement.parentElement.previousSibling;
	if (right == total && (instruction.className.includes("stage-i") || instruction.className.includes("tl-instr"))) {
		instruction.classList.add("right");
		checkForGreen();
	} else {
		instruction.classList.remove("right");
		checkForGreen();
	};
	if (instruction.parentElement.className == "target-language") {
		checkForGreenInTL(instruction.parentElement);
	};
};

function checkGap(item) {

	if (item.value == item.getAttribute("answer")) {
		item.classList.remove("mostly-right", "writing");
		item.classList.add("right");
		item.nextElementSibling.classList.remove("mostly-right", "writing");
		item.nextElementSibling.classList.add("right");
	} else if (editDistance(item.value.trim(), item.getAttribute("answer")) < 2 &&
		item.value.length == item.getAttribute("answer").length) {
		item.classList.remove("writing", "right");
		item.classList.add("mostly-right");
		item.nextElementSibling.classList.remove("writing", "right");
		item.nextElementSibling.classList.add("mostly-right");
	} else {
		item.classList.remove("mostly-right", "right");
		item.classList.add("writing");
		item.nextElementSibling.classList.remove("mostly-right", "right");
		item.nextElementSibling.classList.add("writing");
	}
	var total = item.parentElement.parentElement.querySelectorAll("input.gap").length;
	var right = item.parentElement.parentElement.querySelectorAll("input.gap.right").length;
	var instruction = item.parentElement.parentElement.previousSibling;
	if (right == total) { //Add the checkmark to the heading so the student knows the exercise is done
		if (instruction.tagName == ("TR")) {
			instruction = instruction.parentElement.parentElement.previousSibling
		};
		if (instruction.classList.contains("box")) {
			instruction = instruction.previousSibling
		};
		if (instruction.classList.contains("tl-instr") || instruction.classList.contains("stage-i")) {
			instruction.classList.add("right");
			checkForGreen();
		};
	} else {
		if (instruction.tagName == ("TR")) {
			instruction = instruction.parentElement.parentElement.previousSibling
		};
		if (instruction.classList.contains("box")) {
			instruction = instruction.previousSibling
		};
		if (instruction.classList.contains("tl-instr") || instruction.classList.contains("stage-i")) {
			instruction.classList.remove("right");
			checkForGreen();
		};
	};
	if (instruction.parentElement.className == "target-language") {
		checkForGreenInTL(instruction.parentElement);
	};
	//item.innerHTML = item.innerHTML.replace("<br>", "");
};


function checkEssay(item) {
	item.classList.add("degrees");
	var similarities = [];
	var answers = item.getAttribute("answer").split("\n");
	if (!item.nextSibling) {
		var indicator = document.createElement("span");
	} else {
		var indicator = item.nextSibling;
	};
	for (answer in answers) {
		similarities[answer] = similarity(item.value.trim(), answers[answer]);
	};
	var max = (Math.max.apply(null, similarities) * 100);
	indicator.innerHTML = " " + parseFloat(max.toFixed(1)) + "%";
	item.insertAdjacentElement("afterEnd", indicator);
	item.classList.add("degrees");
	indicator.classList.add("degrees");
	//hsl(0, 0%, 0%);
	item.style.animationDelay = 0 - max + "s";
	indicator.style.animationDelay = 0 - max + "s";

	if (max == 100) {
		item.classList.add("right");
	} else {
		item.classList.remove("right");
	};

	var total = item.parentElement.parentElement.querySelectorAll("textarea.essay").length;
	var right = item.parentElement.parentElement.querySelectorAll("textarea.essay.right").length;
	if (right == total) {
		var instruction = item.parentElement.parentElement.previousSibling;
		instruction.classList.add("right");
		checkForGreen();
	} else {
		var instruction = item.parentElement.parentElement.previousSibling;
		instruction.classList.remove("right");
		checkForGreen();
	};
	
};

function checkUnscrambling(item) {
	item.classList.add("degrees");
	var answer = item.getAttribute("answer")
	if (!item.nextElementSibling) {
		var indicator = document.createElement("span");
	} else {
		var indicator = item.nextElementSibling;
	};
	var siml = similarity(item.value.trim(), answer) * 100;
	//console.log(answer + " " + similarity);
	indicator.innerHTML = " " + parseFloat(siml.toFixed(1)) + "%";
	item.insertAdjacentElement("afterEnd", indicator);
	item.classList.add("degrees");
	indicator.classList.add("degrees");
	//hsl(0, 0%, 0%);
	item.style.animationDelay = 1 - siml + "s";
	indicator.style.animationDelay = 1 - siml + "s";
	if (siml == 100) {
		item.classList.add("right");
	} else {
		item.classList.remove("right");
	};
	var total = item.parentElement.parentElement.querySelectorAll("input.scramble").length;
	var right = item.parentElement.parentElement.querySelectorAll("input.scramble.right").length;
	if (right == total) {
		var instruction = item.parentElement.parentElement.previousSibling;
		instruction.classList.add("right");
		checkForGreen();
	} else {
		var instruction = item.parentElement.parentElement.previousSibling;
		instruction.classList.remove("right");
		checkForGreen();
	};
	
};

function checkChecking(item) {
	var span = item.parentElement.parentElement.querySelector("span");
	span.className = "degrees";
	var checkboxes = item.parentElement.parentElement.querySelectorAll("input");
	var binaries = "";
	var counter = 0;
	for (box of checkboxes) {
		if (box.checked) {
			binaries += "1";
		} else {
			binaries += "0";
		};
		counter++;
	};
	var siml = similarity(span.getAttribute("answer"), binaries);
	if (siml <= 0.375) {
		span.classList.remove("right", "mostly-right", "not-quite-right");
		span.classList.add("wrong");
	} else if (siml > 0.375 && siml <= 0.625) {
		span.classList.remove("right", "mostly-right", "wrong");
		span.classList.add("not-quite-right");
	} else if (siml > 0.625 && siml < 1) {
		span.classList.remove("right", "not-quite-right", "wrong");
		span.classList.add("mostly-right");
	} else if (siml == 1) {
		span.classList.remove("mostly-right", "not-quite-right", "wrong");
		span.classList.add("right");
	};
	span.classList.add("degrees");
	span.style.animationDelay = 1 - siml * 100 + "s";

	var total = item.parentElement.parentElement.parentElement.querySelectorAll(".itemcell span").length;
	var right = item.parentElement.parentElement.parentElement.querySelectorAll("span.degrees.right").length;
	if (right == total) {
		var instruction = item.parentElement.parentElement.parentElement.parentElement.parentElement.previousSibling;
		instruction.classList.add("right");
		checkForGreen();
	} else {
		var instruction = item.parentElement.parentElement.parentElement.parentElement.parentElement.previousSibling;
		instruction.classList.remove("right");
		checkForGreen();
	};
	
};


var indexBuffer = undefined;
var classBuffer = undefined;
var itemBuffer = undefined;

function checkMatching(item) {
	drawLine(item);
	var svgcanvas = item.parentElement.parentElement.parentElement.parentElement.children[0];
	var itemindex = item.getAttribute("index");
	var itemclass = item.className;

	if (itemBuffer != undefined) {
		var index1 = itemBuffer.getAttribute("index");
		var class1 = itemBuffer.className.baseVal;
		var index2 = itemindex;
		var class2 = itemclass;
		//indexBuffer = undefined;
		//classBuffer = undefined;
	} else if (itemBuffer == undefined) {
		var index1 = itemindex;
		var class1 = itemclass;
		var index2 = undefined;
		var class2 = undefined;
		//indexBuffer = index1;
		//classBuffer = class1;
		itemBuffer = item;
	};
	if (index1 && index2 && index1 == index2 && class1 != class2) {
		svgcanvas.lastChild.classList.add("right");
		//item.classList.add("right");
		//itemBuffer.classList.add("right");
		itemBuffer = undefined;
	} else if (index1 && index2 && class1 != class2) {
		svgcanvas.lastChild.classList.add("wrong");
		//item.classList.add("wrong");
		//itemBuffer.classList.add("wrong");
		itemBuffer = undefined;
	};
	var total = item.parentElement.parentElement.querySelector(".match-area").rowSpan;
	if (svgcanvas.getElementsByClassName("right").length == total) {
		var instruction = item.parentElement.parentElement.parentElement.parentElement.previousSibling.previousSibling;
		instruction.classList.add("right");
		checkForGreen();
	};
	
};

var coordsbuffer = {};

function drawLine(item) {
	var allcells = item.parentElement.parentElement.querySelectorAll("td");
	item.style.backgroundColor = "hsl(60, 100%, 45%)";

	if (coordsbuffer.top != undefined) {
		var coords1 = coordsbuffer;
	} else {
		var coords1 = {};
		for (cell of allcells) {
			cell.style.backgroundColor = "";
		};
		item.style.backgroundColor = "hsl(60, 100%, 45%)";

	}
	var coords2 = {};
	var svgcanvas = item.parentElement.parentElement.parentElement.parentElement.children[0];
	var itemcoords = offset(item);
	//console.log(itemcoords);
	if (coords1.top == undefined) {
		coords1.top = itemcoords.top;
		coords1.left = itemcoords.left;
		coordsbuffer = coords1;
	} else {
		coords2.top = itemcoords.top;
		coords2.left = itemcoords.left;
	};
	if (coords1.top == coords2.top && coords1.left == coords2.left) {
		svgcanvas.lastChild.remove();
		coordsbuffer = {};
	} else if (coords1.top && coords2.top) {
		//console.log("Ready to draw " + JSON.stringify(coords1) + JSON.stringify(coords2));
		var line = document.createElementNS(xmlns, 'line');
		line.setAttributeNS(null, 'stroke', 'rgb(128,128,128)');
		line.setAttributeNS(null, 'stroke-width', '3px');
		line.setAttributeNS(null, 'stroke-linecap', 'round');
		line.setAttributeNS(null, 'x1', coords1.left);
		line.setAttributeNS(null, 'y1', coords1.top);
		line.setAttributeNS(null, 'x2', coords2.left);
		line.setAttributeNS(null, 'y2', coords2.top);
		if (indexBuffer != undefined) {
			line.setAttributeNS(null, 'index1', item.getAttribute("index"));
		} else if (indexBuffer == undefined) {
			line.setAttributeNS(null, 'index2', item.getAttribute("index"));
		};
		svgcanvas.append(line);
		//svgcanvas.lastChild.setAttributeNS(null ,"class", "mostly-right");
		coordsbuffer = {};
	};
};

function offset(item) {
	if (item.className.includes("r-side")) {
		var sideX = item.offsetLeft;
	} else if (item.className.includes("l-side")) {
		var sideX = item.offsetLeft + item.offsetWidth;
	};
	var centerY = item.offsetTop + item.offsetHeight / 2;
	return {
		top: centerY,
		left: sideX
	};
};

function highlightLine(item) {
	var svgcanvas = item.parentElement.parentElement.parentElement.parentElement.children[0];
	var lines = svgcanvas.children;
};

function clearCells(item) {
	var allcells = item.parentElement.parentElement.querySelectorAll("td");
	for (cell of allcells) {
		cell.style.backgroundColor = "";
	};
};

function flipFlashCard(item) {
	item.parentElement.classList.toggle("toggle");
	item.parentElement.setAttribute("flipped", "");
	var total = item.parentElement.parentElement.querySelectorAll(".flashcard").length;
	var flipped = item.parentElement.parentElement.querySelectorAll(".flashcard[flipped]").length;
	if (flipped == total) {
		var instruction = item.parentElement.parentElement.previousSibling;
		instruction.classList.add("right");
		checkForGreen();
	} else {
		var instruction = item.parentElement.parentElement.previousSibling;
		instruction.classList.remove("right");
		checkForGreen();
	};
};

function showHideConv(item) {
	var lines = item.parentElement.nextSibling.querySelectorAll("p");
	if (lines[0].classList.contains("dim")) {
		for (l of lines) {
			l.classList.remove("dim");
		};
	} else {
		for (l of lines) {
			l.classList.add("dim");
		};
	}
};

function setZoom() {
	var slider = document.querySelector("#zoomer");
	var sheet = document.querySelector(".sheet");
	sheet.style.zoom = slider.value / 10;
};

function invertColors(button) {
	var sheet = document.querySelector(".sheet");
	sheet.classList.toggle("inverted");
	if (sheet.classList.contains("inverted")) {
		button.innerHTML = "☀️";
	} else {
		button.innerHTML = "🌙";
	};

};

function dimConvo(item) {
	var selCharacter = item.getAttribute("character");
	var charsarray = Array.from(item.parentElement.children);
	if (!item.classList.contains("dim") && !charsarray.some(function (e) {
			return e.classList.contains("dim")
		})) {
		for (line of item.parentElement.children) {
			if (line.getAttribute("character") != selCharacter) {
				line.classList.add("dim");
			} else {
				line.classList.remove("dim");
			};
		};
	} else {
		for (line of item.parentElement.children) {
			line.classList.remove("dim");
		};
	};
};

function timer(start) {
	this.start = start;
	this.age = function () {
		return Date.now() - start
	};
}

function showText(item, time) {
	var text = item.parentElement.nextElementSibling.firstElementChild;
	var againbutton = item.nextSibling;
	text.classList.remove("blurred");
	setTimeout(function () {
		text.classList.add("blurred");
		againbutton.removeAttribute("disabled");
		var instruction = item.parentElement.previousSibling;
		instruction.classList.add("right");
		checkForGreen();
	}, time + 2000);
	item.setAttribute("disabled", "");
};

function againText(item) {
	var startbutton = item.previousSibling;
	startbutton.removeAttribute("disabled");
	item.setAttribute("disabled", "");
};

function cleanMatching(item) {
	var lines = Array.from(item.parentElement.nextElementSibling.children[0].children);
	for (line in lines) {
		if (lines[line].className.baseVal != "right") {
			lines[line].remove();
		};
	};
};

function checkPic(item) {
	var pic = item.parentElement.nextSibling;
	pic.classList.remove("hiddenpic");
	var instruction = item.parentElement.previousSibling;
	setTimeout(function () {
		instruction.classList.add("right");
		checkForGreen();
	}, 10000);
	
};
var videos_instructions = new Array;

function onYouTubePlayerAPIReady() {
	var lesson_videos = Array.from(document.querySelectorAll(".mainvid"));
	try {
		for (v in lesson_videos) {
			player = new YT.Player(lesson_videos[v].id, {
				host: 'https://www.youtube.com',
				videoId: videosList[v],
			});
			var vtitle = lesson_videos[v].previousSibling;
			player.addEventListener('onStateChange', function (e) {
				if (e.data === 0) {
					//vtitle.classList.add("right");
					e.target.a.previousSibling.classList.add("right");
					checkForGreen();
				}
			});
		};
	} catch(err) {
		console.log("YouTube error");
	}
	
};

function checkSorting(item) {
	var catindex = item.parentElement.cellIndex;
	var header = item.parentElement.parentElement.parentElement.parentElement.children[0].children[0].children[catindex];
	while (header.childElementCount > 1) {
		header.lastElementChild.remove();
	};
	var answers = header.getAttribute("items");
	var indicator = document.createElement("span");
	var similarities = [];

	sim = similarity(item.value.trim().split("\n").sort().join("\n"), answers.split("\n").sort().join("\n").trim()) * 100;

	indicator.innerHTML = " " + parseFloat(sim.toFixed(1)) + "%";
	header.append(indicator);
	header.classList.add("degrees");
	item.classList.add("degrees");
	header.style.animationDelay = 0 - sim + "s";
	item.style.animationDelay = 0 - sim + "s";

	if (sim == 100) {
		item.nextElementSibling.classList.add("right");
	} else {
		item.nextElementSibling.classList.remove("right");
	};
	var table = item.parentElement.parentElement.parentElement.parentElement;

	var total = header.parentElement.childElementCount;
	var right = table.querySelectorAll(".right").length;
	//console.log("r:" + right + " t:" + total)
	var instruction = table.parentElement.previousSibling.previousSibling
	if (right == total && instruction.classList.contains("stage-i")) {
		instruction.classList.add("right");
		checkForGreen();
	} else {
		instruction.classList.remove("right");
		checkForGreen();
	};
	
};

function checkMultisel(item) {
	var parent = item.parentElement;
	var answer = parent.getAttribute("answer");

	for (it = 0; it < parent.childElementCount; it++) {
		parent.children[it].classList.remove("right");
		parent.children[it].classList.remove("wrong");
	};
	if (item.innerHTML == answer) {
		item.classList.add("right");
	} else {
		item.classList.add("wrong");
	};

	var instruction = parent.parentElement.parentElement.previousSibling;
	var total = parent.parentElement.parentElement.querySelectorAll(".sel").length;
	var right = parent.parentElement.parentElement.querySelectorAll(".right").length;
	if (right == total && instruction.classList.contains("stage-i")) {
		instruction.classList.add("right");
		checkForGreen();
	} else {
		instruction.classList.remove("right");
		checkForGreen();
	};
	
};

function checkPick(item) {
	item.classList.toggle(item.getAttribute("pick"));

	var total = item.parentElement.parentElement.querySelectorAll("[pick=\"right\"]").length;
	var right = item.parentElement.parentElement.querySelectorAll(".pickitem span.right").length;
	var instruction = item.parentElement.parentElement.previousSibling;
	if ((right == total && instruction.classList.contains("tl-instr")) || (right == total && instruction.classList.contains("stage-i"))) {
		if (instruction.classList.contains("box")) {
			instruction = instruction.previousSibling
		};
		instruction.classList.add("right");
		checkForGreen();
	} else {
		if (instruction.classList.contains("box")) {
			instruction = instruction.previousSibling
		};
		instruction.classList.remove("right");
		checkForGreen();
	};
	if (instruction.parentElement.className == "target-language") {
		checkForGreenInTL(instruction.parentElement);
	};
};

memBuffer = undefined;

function checkMemory(item) {
	var table = item.parentElement;
	item.classList.toggle("flipped");
	item.removeAttribute("onclick");
	if (memBuffer == undefined) {
		memBuffer = item;
		var index1 = memBuffer;
		var index2 = undefined
	} else {
		var index1 = item;
		var index2 = memBuffer;
		memBuffer = undefined;
		index1.setAttribute("onclick", "checkMemory(this)");
		index2.setAttribute("onclick", "checkMemory(this)");
	};
	if (index2 != undefined && index1.getAttribute("index") == index2.getAttribute("index") && index1 != index2) {

		for (card = 0; card < 2; card++) {
			var cardsinquestion = table.querySelectorAll("[index=\"" + index1.getAttribute("index") + "\"]");
			cardsinquestion[card].removeAttribute("onclick");

			var card_int = cardsinquestion[card].querySelector(".fcardno");
			card_int.classList.add("right");
			card_int.innerHTML = (parseInt(cardsinquestion[card].getAttribute("index")) + 1) + ". ";

		};
	} else if (index2 != undefined) {
		var cardsinquestion = [index1, index2];
		for (card = 0; card < 2; card++) {
			cardsinquestion[card].removeAttribute("onclick");
		};
		setTimeout(function () {
			for (card = 0; card < 2; card++) {
				cardsinquestion[card].classList.remove("flipped");
				cardsinquestion[card].setAttribute("onclick", "checkMemory(this)");
			}
		}, 2000);
	};
	var total = table.children.length;
	var right = table.querySelectorAll(".right").length;
	var instruction = table.previousSibling;
	if (right == total && instruction.classList.contains("stage-i")) {
		instruction.classList.add("right");
		checkForGreen();
	}
};

/////////////////////////////////////
/////Misc functions - stay away//////
/////////////////////////////////////

function randomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min;
}

function shuffle(array) {

	var currentIndex = array.length;
	var temporaryValue, randomIndex;

	// While there remain elements to shuffle...
	while (0 !== currentIndex) {
		// Pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;

		// And swap it with the current element.
		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}

	return array;
};

function imgpreload(url) {
	var img = new Image();
    img.src = url;
    img.setAttribute("style", "position:absolute");
    document.querySelector("#img-cache").appendChild(img);
};

function similarity(s1, s2) {
	var longer = s1;
	var shorter = s2;
	if (s1.length < s2.length) {
		longer = s2;
		shorter = s1;
	}
	var longerLength = longer.length;
	if (longerLength == 0) {
		return 1.0;
	}
	return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(source, target) {
	if (!source) return target ? target.length : 0;
	else if (!target) return source.length;

	var m = source.length,
		n = target.length,
		INF = m + n,
		score = new Array(m + 2),
		sd = {};
	for (var i = 0; i < m + 2; i++) score[i] = new Array(n + 2);
	score[0][0] = INF;
	for (var i = 0; i <= m; i++) {
		score[i + 1][1] = i;
		score[i + 1][0] = INF;
		sd[source[i]] = 0;
	}
	for (var j = 0; j <= n; j++) {
		score[1][j + 1] = j;
		score[0][j + 1] = INF;
		sd[target[j]] = 0;
	}

	for (var i = 1; i <= m; i++) {
		var DB = 0;
		for (var j = 1; j <= n; j++) {
			var i1 = sd[target[j - 1]],
				j1 = DB;
			if (source[i - 1] === target[j - 1]) {
				score[i + 1][j + 1] = score[i][j];
				DB = j;
			} else {
				score[i + 1][j + 1] = Math.min(score[i][j], Math.min(score[i + 1][j], score[i][j + 1])) + 1;
			}
			score[i + 1][j + 1] = Math.min(score[i + 1][j + 1], score[i1] ? score[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1) : Infinity);
		}
		sd[source[i - 1]] = i;
	}
	return score[m + 1][n + 1];
}

function sayWord(item) {
	flashcard = item.parentElement;
	var audio = flashcard.querySelector("audio");
	if (item.className == "exp") {
		audio = item.querySelector("audio");
	};
	audio.play();
};

function toggleToolbar() {
	var toolbar = document.querySelector("#lesson-toolbar");
	toolbar.classList.toggle("shown");
};

function toggleChat() {
	var chat = document.querySelector("#chat");
	chat.classList.toggle("chat-stowed");
};

function getRandomElementOf(array) {
	return array[Math.floor(Math.random() * array.length)];
};

function loadClass() {
	var toolbar = document.querySelector("#lesson-toolbar");
	var classlang = toolbar.querySelectorAll("input")[0].value.toLowerCase();
	var classcourse = toolbar.querySelectorAll("input")[1].value.toLowerCase();
	var classlevel = toolbar.querySelectorAll("input")[2].value.toLowerCase();
	var classnumber = toolbar.querySelectorAll("input")[3].value.toString().padStart(3, "0");
	window.location = "index.html?lang=" + classlang + "&course=" +
		classcourse + "&level=" + classlevel + "&class=" + classnumber;
};


///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////
/////////////////////Visual novel functions////////////////////////
///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////

function parseLine(item, scene, line) {
	var novel = item;
	var script = the_class.stages["stage" + item.getAttribute("document-stage")].entries["entry" + item.getAttribute("document-entry")].script;
	var scriptScene = item.getAttribute("scene");
	var scriptLine = item.getAttribute("line");
	var scene = script["scene" + scriptScene];
	
	if (scriptScene == Object.keys(script).length - 1) {
		//~console.log("Last scene!!!")
		if (scriptLine == scene.lines.length - 2) {
			//~console.log("Last line!!!")
			if (item.previousElementSibling.previousElementSibling.classList.contains("stage-i")) {
				item.previousElementSibling.previousElementSibling.classList.add("right");
				checkForGreen();
			};
			//~return 0;
		};
	}
	
	if (script["scene" + scriptScene]) {
		var line = script["scene" + scriptScene].lines[scriptLine];
	} else {
		return 0;
	};
	
	var caption = novel.querySelector(".novel-caption");
	if (caption) {
		caption.remove()
	};
	var speech = novel.querySelector(".novel-speech");
	if (speech) {
		speech.remove()
	};
	var pic = novel.querySelector(".char-pic");
	if (pic) {
		pic.remove()
	};

	switch (line.type) {
		case "caption":
			novel.setAttribute("onclick", "advance(this)");
			var caption = document.createElement("div");
			caption.className = "novel-caption";
			caption.innerHTML = line.text;
			novel.append(caption);
			break;

		case "speech":
			novel.setAttribute("onclick", "advance(this)");
			var charname = script["scene" + scriptScene].characters[line.char].name;
			var charpic = script["scene" + scriptScene].characters[line.char].pic;

			var speech = document.createElement("div");
			speech.className = "novel-speech";

			var chartag = document.createElement("div");
			chartag.className = "char-tag";
			chartag.innerHTML = charname;

			var charspeech = document.createElement("span");
			charspeech.className = "char-speech";
			charspeech.innerHTML = line.text;
			if (line.text.includes("!")){
				charspeech.classList.add("shout1");
			}
			if (line.text.includes("!!")) {
				charspeech.classList.add("shout2");
			}
			if (line.text.includes("!!!")) {
				charspeech.classList.add("shout3");
			}
			if (line.text.includes("*")) {
				charspeech.classList.add("noise");
			}

			var charpicture = document.createElement("img");
			charpicture.className = "char-pic";
			charpicture.src =  charpic ;
			if (line.inv == true) {
				charpicture.classList.add("mir");
			};
			if (line.text.startsWith("(") && line.text.endsWith(")")) {
				charpicture.classList.add("mon");
			}

			if (line.position == "l") {
				charpicture.style.left = "0";
				chartag.style.left = "0";
			} else if (line.position == "r") {
				charpicture.style.right = "0";
				chartag.style.right = "0";
			}
			speech.append(chartag, charspeech);
			novel.append(charpicture, speech);

			break;
		case "prompt":
			novel.removeAttribute("onclick");
			var speech = document.createElement("div");
			speech.className = "novel-speech";

			for (opt in line.options) {
				var option = document.createElement("p");
				option.className = "novel-option";
				option.innerHTML = line.options[opt].text;
				option.setAttribute("onclick", "selectOption(this.parentElement.parentElement, this)");
				option.setAttribute("destination", line.options[opt].destination);
				speech.append(option);
			};
			novel.append(speech);
			break;
		case "jump":
			var scene = parseInt(line.destination.split("-")[0]);
			var line = parseInt(line.destination.split("-")[1]);
			novel.setAttribute("scene", scene);
			novel.setAttribute("line", line);
			advance(novel);
			item.setAttribute("line", parseInt(item.getAttribute("line")) - 1);
			break;
	};
};

function setScene(item) {
	var script = the_class.stages["stage" + item.getAttribute("document-stage")].entries["entry" + item.getAttribute("document-entry")].script;
	var scriptScene = item.getAttribute("scene");
	var scriptLine = item.getAttribute("line");
	var scene = script["scene" + scriptScene]
	if (scene.background.includes(".")) {
		item.style.backgroundImage = "url(" + scene.background + ")";
	} else {
		item.style.background = scene.background;
	};
};

function advance(item) {
	var script = the_class.stages["stage" + item.getAttribute("document-stage")].entries["entry" + item.getAttribute("document-entry")].script;
	var scene = script["scene" + item.getAttribute("scene")];

	if (!scene || item.getAttribute("scene") == Object.keys(script).length && item.getAttribute("line") == scene.lines.length) {
		item.setAttribute("scene", 0);
		item.setAttribute("line", 0);
	} else if (item.getAttribute("line") == scene.lines.length) {
		item.setAttribute("scene", parseInt(item.getAttribute("scene")) + 1);
		item.setAttribute("line", 0);
	}


	var line = script["scene" + item.getAttribute("scene")].lines[item.getAttribute("line")];
	setScene(item);
	parseLine(item, item.getAttribute("scene"), item.getAttribute("line"));

	item.setAttribute("line", parseInt(item.getAttribute("line")) + 1);
}

function retreat(item) {
	var script = the_class.stages["stage" + item.parentElement.getAttribute("document-stage")].entries["entry" + item.parentElement.getAttribute("document-entry")].script;
	if (item.parentElement.getAttribute("scene") > 0 && item.parentElement.getAttribute("line") == 1) {
		item.parentElement.setAttribute("scene", parseInt(item.parentElement.getAttribute("scene")) - 1);
	};
	item.parentElement.setAttribute("line", 0);

	var scene = script["scene" + item.parentElement.getAttribute("scene")];
	var line = script["scene" + item.parentElement.getAttribute("scene")].lines[item.parentElement.getAttribute("line")];

	setScene(item.parentElement);
	parseLine(item.parentElement, item.parentElement.getAttribute("scene"), item.parentElement.getAttribute("line"));
}

function selectOption(item, opt) {
	item.setAttribute("scene", parseInt(opt.getAttribute("destination").split("-")[0]));
	item.setAttribute("line", parseInt(opt.getAttribute("destination").split("-")[1]));
	parseLine(item, item.getAttribute("scene"), item.getAttribute("line"));
}

/////////////////////////////////////////
//////////Other Misc Functions///////////
/////////////////////////////////////////


function randomG(item) {
	var subtype = item.parentElement.getAttribute("subtype");
	var stage = item.parentElement.getAttribute("document-stage");
	var entry = item.parentElement.getAttribute("document-entry");

	switch (subtype) {
		case "array":
			var slotSources = the_class.stages["stage" + stage].entries["entry" + entry].slots;
			var slotAmount = slotSources.length;
			var slotDisplay = item.parentElement.querySelectorAll(".slot");
			for (sl = 0; sl < slotAmount; sl++){
				slotDisplay[sl].innerHTML = getRandomElementOf(slotSources[sl])
			};
			break;
		case "number":
			var numberDisplay = item.parentElement.querySelector(".slot");
			var classEntry = the_class.stages["stage" + stage].entries["entry" + entry]
			var randomNumber = Math.random();
			numberDisplay.innerHTML = parseFloat(((randomNumber * (classEntry.max - classEntry.min) + classEntry.min)
			- ((randomNumber * (classEntry.max - classEntry.min) + classEntry.min) % classEntry.step)).toFixed(5));
				
			break;
		case "madlibs":
			var slotSources = the_class.stages["stage" + stage].entries["entry" + entry].mobile;
			var slotAmount = slotSources.length;
			var slotDisplay = item.parentElement.querySelectorAll(".madlib");
			var results = [];
			for (sl = 0; sl < slotDisplay.length; sl++){
				if (slotSources[slotDisplay[sl].getAttribute("slot")].length == 1
				&& slotSources[slotDisplay[sl].getAttribute("slot")][0].split(",").length == 3) {
					var min = parseFloat(slotSources[slotDisplay[sl].getAttribute("slot")][0].split(",")[0]);
					var max = parseFloat(slotSources[slotDisplay[sl].getAttribute("slot")][0].split(",")[1]);
					var stp = parseFloat(slotSources[slotDisplay[sl].getAttribute("slot")][0].split(",")[2]);
					var rnd = Math.random();
					slotDisplay[sl].innerHTML = parseFloat(((rnd * (max - min) + min) - ((rnd * (max - min) + min) % stp)).toFixed(5));
				} else {
					if (the_class.stages["stage" + stage].entries["entry" + entry].repeat[sl] == false) {
						do {
							var prospect = getRandomElementOf(slotSources[slotDisplay[sl].getAttribute("slot")]);
						} while (results.includes(prospect));
					} else {
						var prospect = getRandomElementOf(slotSources[slotDisplay[sl].getAttribute("slot")]);
					};
					results.push(prospect);
					slotDisplay[sl].innerHTML = prospect;
				};
			};
			break;
		case "dice":
			var dice = item.parentElement.children[0].valueAsNumber;
			var faces = parseInt(item.parentElement.children[1].value);
			var modpolarity = parseInt(item.parentElement.children[2].value);
			var modifier = item.parentElement.children[3].valueAsNumber;
			var resultDisplay = item.parentElement.querySelector(".slot");
			var roll = 0;
			for (dd = 0; dd < dice; dd++) {
				roll += randomInt(1, faces + 1);
			};
			roll = roll + (modifier * modpolarity)
			resultDisplay.innerHTML = roll
			
			break;
	};
	if (item.parentElement.previousElementSibling.classList.contains("stage-i")) {
		item.parentElement.previousElementSibling.classList.add("right");
		checkForGreen();
	};
};

function toggleTree(button) {
	var classArea = document.getElementById("lesson-content")
	if (button.innerHTML == "📖") {
		classArea.style.marginRight = "64mm";
		var tbubbles = document.querySelectorAll(".t-bubble");
		for (b of tbubbles) {
			b.style.marginRight = "76mm";
		};
		var sideMenu = document.createElement("div");
		sideMenu.id = "side-menu"
		classArea.parentElement.parentElement.insertBefore(sideMenu, document.querySelector("#chat"));
		var stagesarray = [];


		//Gather//
		for (stage in the_class.stages) {
			stagesarray.push(the_class.stages[stage].title);
		};

		for (ss = 0; ss < stagesarray.length; ss++) {
			var currentEntries = the_class.stages["stage" + (ss + 1)].entries;
			var shorthandarray = [];
			for (entry in currentEntries) {
				if (currentEntries[entry].type == "instruction") {
					shorthandarray.push(currentEntries[entry].shorthand);
				};
				if (currentEntries[entry].type == "target-language") {

					var tltree = {"main": currentEntries[entry], "ent": []};
					var tlentries = currentEntries[entry].elems;
					for (el in tlentries) {
						if (tlentries[el].type == "instruction") {
							tltree.ent.push(tlentries[el].shorthand);
						}
					};
					
					shorthandarray.push(tltree);
				};
			};
		
		//Show//
		var stageContainer = document.createElement("div");
		var stageHandle = document.createElement("p");
		stageHandle.className = "stage-handle";
		stageHandle.innerHTML = (ss + 1) + ". " + stagesarray[ss];
		stageHandle.setAttribute("onclick", "hideAllStagesBut(" + (ss + 1) + "); this.scrollIntoView()");
		stageContainer.setAttribute("stage", (ss + 1));
		sideMenu.append(stageContainer);
		stageContainer.append(stageHandle);
		for (shrt = 0; shrt < shorthandarray.length; shrt++) {
			var instructionHandle = document.createElement("p");
			instructionHandle.className = "ins-handle";
			instructionHandle.setAttribute("instruction",  (shrt + 1));
			instructionHandle.setAttribute("onclick",  "goToInstruction(this); event.stopPropagation()");
			stageContainer.append(instructionHandle);
			
			if (!shorthandarray[shrt].main) {
				instructionHandle.innerHTML = shorthandarray[shrt];
			} else if (shorthandarray[shrt].main) {
				
				instructionHandle.innerHTML = shorthandarray[shrt].main.shorthand;
				for (elm = 0; elm < shorthandarray[shrt].ent.length; elm++) {
					var tlInsHandle = document.createElement("p");
					tlInsHandle.className = "ins-handle";
					tlInsHandle.setAttribute("instruction",  (shrt + 1));
					tlInsHandle.setAttribute("sub-ins",  (elm + 1));
					tlInsHandle.setAttribute("onclick",  "goToInstruction(this); event.stopPropagation()");
					tlInsHandle.innerHTML = shorthandarray[shrt].ent[elm];
					stageContainer.append(tlInsHandle);
				};
				instructionHandle.classList.add("has-submenu");
			};
		};
	};
		
		button.innerHTML = "📜";
		hideAllStagesBut(1);
		goToInstruction(document.querySelector(".ins-handle"));


		
	} else if (button.innerHTML == "📜") {
		classArea.style.marginRight = "";
		var sideMenu = document.querySelector("#side-menu");
		sideMenu.remove();
		button.innerHTML = "📖";
		showAllStages();
	};
};

function hideAllStagesBut(stageNumber) {
	var allLessonThings = document.querySelectorAll("[document-stage]");
	var activeStageThings = document.querySelectorAll("[document-stage = \"" + stageNumber + "\"]");
	var sideMenu = document.querySelector("#side-menu");

	for (item of allLessonThings) {
		item.style.display = "none";
	};

	for (item of activeStageThings) {
		item.style.display = "";
	};

	for (item of sideMenu.children) {
		item.classList.remove("this-stage");
	};
	sideMenu.querySelectorAll("#side-menu div")[stageNumber - 1].classList.add("this-stage");


	
	//quick and dirty way to access the first instruction in the stage:
	document.querySelectorAll(".stage-handle")[stageNumber - 1].nextElementSibling.click()
	setTimeout(function () { activeStageThings[0].scrollIntoView()}, 100);

};

function showAllStages() {
	var allLessonThings = document.querySelectorAll("[document-stage]");
	for (item of allLessonThings) {
		item.style.display = "";
	};
	document.scrollingElement.scroll(0,0)
};

function goToInstruction(item) {
	var stage = parseInt(item.parentElement.getAttribute("stage")) || parseInt(item.parentElement.parentElement.getAttribute("stage"));
	var instructionsOnDoc = document.querySelectorAll(".stage-i[document-stage=\""+ stage +"\"], .target-language[document-stage=\""+ stage +"\"]");
	//console.log(instructionsOnDoc)
	var instruction = parseInt(item.getAttribute("instruction"));
	var subInstruction = parseInt(item.getAttribute("sub-ins"));
	var allHandles = document.querySelectorAll(".ins-handle");
	for (handle of allHandles) {
		handle.classList.remove("this-instruction");
	};
	item.classList.add("this-instruction");
	
	instructionsOnDoc[instruction - 1].scrollIntoView();
	if (subInstruction) {
		TLSubInstrs = document.querySelectorAll(".target-language[document-stage=\""+ stage +"\"] .tl-instr");
		TLSubInstrs[subInstruction - 1].scrollIntoView();
	};
};

function checkForGreen() {
	//~console.log("Checking for green")
	var stages = document.querySelectorAll("h2.stage");
	var menustages = document.querySelectorAll(".stage-handle");

	for (ss = 1; ss < stages.length + 1; ss++){
		var instructions = document.querySelectorAll(".stage-i[document-stage=\""+ ss +"\"], .target-language[document-stage=\""+ ss +"\"] .tl-title");
		var menuinstructions = document.querySelectorAll("div[stage=\""+ ss +"\"] .ins-handle");
		
		for (ii = 0; ii < instructions.length; ii++) {
						
			if (instructions[ii].classList.contains("right") && instructions[ii].classList.contains("stage-i")) {
				menuinstructions[ii].classList.add("right");
			} else if(instructions[ii].classList.contains("stage-i")){
				menuinstructions[ii].classList.remove("right");
			};
		};
		
		var right = document.querySelectorAll(".stage-i.right[document-stage=\""+ ss +"\"], .target-language[document-stage=\""+ ss +"\"] .tl-title.right");
		
		if (instructions.length == right.length) {
			stages[ss - 1].classList.add("right");
			menustages[ss - 1].classList.add("right");
		} else if (instructions.length > right.length) {
			stages[ss - 1].classList.remove("right"); 
			menustages[ss - 1].classList.remove("right"); 
		};
	};
};

function checkForGreenInTL(targetLanguage) {
	var TLsInPage = document.querySelectorAll(".target-language");
	var WhichStageAmI = parseInt(targetLanguage.getAttribute("document-stage"));
	var menuItemsInStage = document.querySelectorAll("[document-stage=\"" + WhichStageAmI + "\"].stage-i, [document-stage=\"" + WhichStageAmI + "\"].target-language");
	var TLsInSideMenu = document.querySelectorAll(".ins-handle.has-submenu");
	var whichTLAmI = 0;
	var whichOneAmIInMenu = 0;
	
	for (tl = 0; tl < TLsInPage.length; tl++) {
		if (targetLanguage == TLsInPage[tl]) {
			whichTLAmI = tl + 1;
		};
	};

		for (tl = 0; tl < menuItemsInStage.length; tl++) {
		if (targetLanguage == menuItemsInStage[tl]) {
			whichOneAmIInMenu = tl + 1;
		};
	};

	var instructions = targetLanguage.querySelectorAll(".tl-instr");
	var menuInstr = document.querySelectorAll("[stage=\""+ WhichStageAmI +"\"] .ins-handle[instruction=\""+ whichOneAmIInMenu +"\"][sub-ins]");

	for (ii = 0; ii < instructions.length; ii++) {
		if (instructions[ii].classList.contains("right")) {
			menuInstr[ii].classList.add("right");
		} else {
			menuInstr[ii].classList.remove("right");
		};
	};
	var rightins = document.querySelectorAll("[stage=\""+ WhichStageAmI +"\"] .ins-handle[instruction=\""+ whichOneAmIInMenu +"\"][sub-ins].right");

	if (rightins.length == instructions.length) {
		targetLanguage.querySelector(".tl-title").classList.add("right");
		document.querySelector("[stage=\""+ WhichStageAmI +"\"] .ins-handle[instruction=\""+ whichOneAmIInMenu +"\"]").classList.add("right");
		checkForGreen();
		
	} else if (rightins.length < instructions.length) {
		targetLanguage.querySelector(".tl-title").classList.remove("right");
		document.querySelector("[stage=\""+ WhichStageAmI +"\"] .ins-handle[instruction=\""+ whichOneAmIInMenu +"\"]").classList.remove("right");
		checkForGreen();
	};
	
};
