const illegalCharacterRegex = /[:\?!\|#‘’\'\"\.,+\(\)]/g;
const STATUS = require(app.vault.adapter.basePath + "/_views/common/status.js");

const BASE_NOTE_TYPES = [
    "reference",
    "meeting",
    "project",
    "goal",
    "chat",
];

const REVIEW_TYPES = {
    "weekly": 7,
    "monthly": 30,
    "quarterly": 90,
    "yearly": 365,
};

const PERIODIC_TYPES = [
    "journal",
    "daily",
].concat(Object.keys(REVIEW_TYPES));

const DEFAULT_NO_TO_TASKS = [
    "weekly",
    "monthly",
    "quarterly",
    "yearly",
    "reference",
];

const DEFAULT_DONT_ASK_STATUS = [
    "chat",
    "reference",
];

const DEFAULT_DONT_ASK_TASKS = [
    "chat",
];

const DEFAULT_DONT_ASK_ATTACHMENTS = [
    "chat",
];

const DEFAULT_ASK_ASSOC_PROJECT = [
    "chat",
    "journal",
    "meeting",
    "reference",
];

const resourceTClosure = template`resource::\`$= dv.view("section", {file: "${"t"}", searchTerm: "reference", headerName: "Resource", headerNamePlural: "Resources", icon: "🔗", list: true})\``;
const journalTClosure = template`journal::\`$= dv.view("section", {file: "${"t"}", searchTerm: "journal", headerName: "Journal", headerNamePlural: "Journals", icon: "📓"})\``;
const overviewTClosure = template`overview::\`$= dv.view("overview", {file: "${"t"}", interval: "${"i"}"})\``;

/**
 * Prompts the user for default values and initializes variables.
 * @param {object} tp Templater tp object.
 * @param {object} dv Dataview dv object.
 * @return {object} An object of key value pairs.
*/
async function newNoteData(tp, dv) {
    const dateFmt = "ddd Do MMM";

    let folder = tp.file.folder(relative=true);
    let title = tp.file.title;
    let folderPath;
    let type;
    let series;
    let answer;

    // This means the template should have been invoked using TP and not QA
    if (title.startsWith("Untitled")) {
        const folders = getAllFolderPathsInVault(tp);
        folderPath = await getOrCreateFolder(tp, folders);
        title = tp.date.now("YYYY-MM-DD") + "-" + title.toLowerCase();
        title = await tp.system.prompt("Title", title);
        if (folderPath !== folder) {
            await tp.file.move(folderPath + "/" + title);
            folder = folderPath;
        }
    }

    title = textToFilename(title);
    if (title !== tp.file.title)
        await tp.file.rename(title);

    const fileDateISO = tp.date.now("YYYY-MM-DD", 0, title, "YYYY-MM-DD");
    const fileDate = moment(fileDateISO).format(dateFmt);
    const titleWODate = title.split(fileDateISO + "-")[1];

    const dirname = basename(folder);
    const types = BASE_NOTE_TYPES.concat(PERIODIC_TYPES);

    for (const t of types) {
        if (dirname == t)
            type = t;
    }

    switch (type) {
        case "journal":
            series = true;
            break;
        case "daily":
            series = true;
            break;
        case "weekly":
            series = true;
            break;
        case "monthly":
            series = true;
            break;
        case "quarterly":
            series = true;
            break;
        case "yearly":
            series = true;
            break;
        case "project":
            series = false;
            break;
        case "goal":
            series = false;
            break;
        case "chat":
            series = false;
            break;
        case "meeting":
            answer = await tp.system.prompt("Series? (\"Y/n\")", "y");
            if (answer == "y")
                series = true;
            break;
        default:
            if (!type) new Notice("Undefined note type", 5000);
            series = false;
    }

    const aliases = [];
    const alias = await tp.system.prompt(
        "♊ Alias",
        titleWODate ? capitalizeWords(titleWODate.split("-")).join(" ") :
            fileDate + " " + capitalizeWord(type) + " Note",
    );
    aliases.push(alias);

    let subtitle;
    if (type == "goal") {
        subtitle = await tp.system.prompt(
            "🔱 Reason", alias.replace(fileDate + " ", "").toLowerCase());
    } else {
        subtitle = await tp.system.prompt(
            "🔱 Subtitle", alias.replace(fileDate + " ", "").toLowerCase());
    }

    const statuses = {...STATUS.all};

    let status = !DEFAULT_DONT_ASK_STATUS.includes(type) ? await
    tp.system.suggester(
        Object.keys(statuses),
        Object.values(statuses),
        false,
        "Enter status",
    ) : null;

    let goal;
    if (type == "project") {
        answer = await tp.system.prompt("Associate goal? (\"y/N\")", "n");
        if (answer == "y") {
            const goalNotes = dv.pages("#goal")
                .where(p => !p.file.path.includes("template"))
                .sort(p => p.file.mtime, "desc").values;
            goal = await tp.system.suggester(
                p => p.file.aliases.length ? p.file.aliases[0] : p.file.basename,
                goalNotes,
                false,
                "Select goal");
        }
    }
    let goalMeta;
    if (goal)
        goalMeta = createMetaMarkdownLink("goal", goal);

    let project;
    if (DEFAULT_ASK_ASSOC_PROJECT.includes(type)) {
        answer = await tp.system.prompt("Associate project? (\"y/N\")", "n");
        if (answer == "y") {
            const projectNotes = dv.pages("#project")
                .where(p => !p.file.path.includes("template"))
                .sort(p => p.file.mtime, "desc").values;
            project = await tp.system.suggester(
                p => p.file.aliases.length ? p.file.aliases[0] : p.file.basename,
                projectNotes,
                false,
                "Select project");
        }
    }
    let projectMeta;
    if (project)
        projectMeta = createMetaMarkdownLink("project", project);

    cached = app.metadataCache.getTags();
    cached["-- New --"] = 9999;
    const allTags = Object.entries(cached);
    // Add the note type automatically
    // Don't allow it to show in list of choices
    const typeIndex = allTags.findIndex(item => item[0] === `#${type}`);

    let tagFound;
    let removedItem;
    if (typeIndex >= 0) {
        tagFound = true;
        removedItem = allTags.splice(typeIndex, 1)[0];
    }
    const selectedTags = !PERIODIC_TYPES.includes(type) ? await tp.user.multiSuggester(
        tp,
        t => t[0].replace("#", ""),
        allTags,
        false,
        "Choose tags (Enter to make new, ESC when finished)",
        undefined,
        "occurance",
    ) : [];
    // Put the note type back onto the list of tags
    if (!selectedTags.includes(removedItem))
        selectedTags.unshift(removedItem);

    let newTag;
    // Tag has not been created
    if (!tagFound)
        newTag = type;

    let tags;
    if (tagFound)
        tags = selectedTags.map(t => t[0].replace("#", ""));
    else if (newTag)
        tags = [newTag];

    if (tags.includes("book")) {
        status = await tp.system.suggester(
            Object.keys(statuses),
            Object.values(statuses), false, "Enter status");
    }

    let dailyProgress;
    if (["daily", "journal"].includes(type)) {
        const thisDate = new Date(fileDateISO + "T00:00");
        if (tags.includes("work")) {
            // 5 workdays
            dailyProgress = makeProgressBar(
                thisDate.getDay(), 5, size=5, label="Progress");
        } else {
            // 7 weekdays
            dailyProgress = makeProgressBar(
                thisDate.getDay(), 7, size=7, label="Progress");
        }
    }

    let includeFile = "";
    if (tags.includes("standup")) {
        includeFile = await tp.file.include("[[standup]]");
    } else if (tags.includes("1on1")) {
        includeFile = await tp.file.include("[[1on1]]");
    } else if (type == "journal") {
        includeFile = await tp.file.include("[[journal]]");
    } else if (type == "daily") {
        includeFile = await tp.file.include("[[daily]]");
    } else if (type == "weekly") {
        includeFile = await tp.file.include("[[weekly]]");
    } else if (type == "monthly") {
        includeFile = await tp.file.include("[[monthly]]");
    } else if (type == "quarterly") {
        includeFile = await tp.file.include("[[quarterly]]");
    } else if (type == "yearly") {
        includeFile = await tp.file.include("[[yearly]]");
    } else if (type == "meeting") {
        includeFile = await tp.file.include("[[meeting]]");
    } else if (type == "goal") {
        includeFile = await tp.file.include("[[goal]]");
    } else if (type == "reference") {
        if (tags.includes("book"))
            includeFile = await tp.file.include("[[book]]");
        else
            includeFile = await tp.file.include("[[reference]]");
    }

    let nav;
    if (series)
        nav = 'nav::`$= dv.view("navigation", {file: "' + title + '"})`';

    let taskProgress;
    if (DEFAULT_DONT_ASK_TASKS.includes(type))
        answer = null;
    else if (DEFAULT_NO_TO_TASKS.includes(type))
        answer = await tp.system.prompt("Track progress using tasks? (\"y/N\")", "n");
    else
        answer = await tp.system.prompt("Track progress using tasks? (\"Y/n\")", "y");
    if (answer == "y") {
        let progressView;
        switch (type) {
            case "project":
                progressView = "total-progress-bar";
                break;
            case "goal":
                progressView = "total-progress-bar";
                break;
            default:
                progressView = "page-progress-bar";
        }
        taskProgress = (
            'bar::`$= dv.view("' + progressView + '", {file: "' + title + '"})`');
    }

    let overview;
    if (Object.keys(REVIEW_TYPES).includes(type))
        overview = overviewTClosure({t: title, i: REVIEW_TYPES[type]});

    let journalView;
    let resourceView;
    let projectDataView;

    if (type == "project") {
        projectDataView = (
            'project-dv::`$= dv.view("project-dv", {file: "' + title + '"})`');
    } else {
        journalView = journalTClosure({t: title});
        resourceView = resourceTClosure({t: title});
    }

    let target;
    let progress;
    let projectListView;
    let projectTableView;
    let timeSpan;
    if (type == "goal") {
        const choices = [
            "10 Years", "5 Years", "3 Years", "1 Year", "6 Months",
            "3 Months", "1 Month", "1 Week",
        ];
        timeSpan = await tp.system.suggester(choices, choices);
        target = 'target::`$= dv.view("target", {file: "' + title + '"})`';
        progress = 'progress::`$= dv.view("progress", {file: "' + title + '"})`';
        projectListView = (
            'projects::`$= dv.view("section", {file: "' + title +
            '", searchTerm: "project", headerName: "Project", ' +
            'headerNamePlural: "Projects", icon: "🏗", list: true})`'
        );
        projectTableView = (
            'project-tv::`$= dv.view("section", {file: "' + title +
            '", searchTerm: "project", headerName: "Project", ' +
            'headerNamePlural: "Projects", icon: "🏗"})`'
        );
    }

    let image;
    if (DEFAULT_DONT_ASK_ATTACHMENTS.includes(type))
        answer = null;
    else
        answer = await tp.system.prompt("Include attachment? (\"y/N\")", "n");

    if (answer == "y") {
        const files = app.vault.getFiles()
            .filter(f => f.path.includes("attachments/") &&
                ["png", "jpg"].includes(f.extension))
            .sort(f => f.ctime, "desc");
        const pickedImg = await tp.system.suggester(file => file.basename, files);
        image = `img::[[${pickedImg.name}]]`;
    }

    return {
        date: fileDateISO,
        title: alias,
        titleSuffix: titleWODate,
        subtitle: subtitle,
        tags: tags,
        alias: alias,
        aliases: aliases,
        type: type,
        series: series,
        includeFile: includeFile,
        status: status,
        dailyProgress: dailyProgress,
        taskProgress: taskProgress,
        nav: nav,
        img: image,
        project: projectMeta,
        goal: goalMeta,
        journal: journalView,
        resource: resourceView,
        projectLV: projectListView,
        cssClasses: [],
        target: target,
        progress: progress,
        projectTV: projectTableView,
        timeSpan: timeSpan,
        projectDV: projectDataView,
        overview: overview,
    };
}

/**
 * Helper Functions
*/

/**
 * Create a function that parses template literals
 * Yoinked from:
 *   https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates
 * @param {Array<string>} strings array of strings which may contain ${…} substitutions
 * E.g. `${0}${1}${0}` or `${0} ${"foo"}` or `hey, ${0} ${"foo"} you!`
 * @param {Array<any>} keys keys are strings or numbers inside substitutions
 * E.g. `${0}` or `${"foo"}`
 * @return {function(): string}
 * @example
 *   const t1Closure = template`${0}${1}${0}!`;
 *   // const t1Closure = template(["","","","!"],0,1,0);
 *   t1Closure("Y", "A"); // "YAY!"
 *
 *   const t2Closure = template`${0} ${"foo"}!`;
 *   // const t2Closure = template([""," ","!"],0,"foo");
 *   t2Closure("Hello", { foo: "World" }); // "Hello World!"
 *
 *   const t3Closure = template`I'm ${"name"}. I'm almost ${"age"} years old.`;
 *   // const t3Closure = template(["I'm ", ". I'm almost ", " years old."], "name", "age");
 *   t3Closure("foo", { name: "MDN", age: 30 }); // "I'm MDN. I'm almost 30 years old."
 *   t3Closure({ name: "MDN", age: 30 }); // "I'm MDN. I'm almost 30 years old."
 */
function template(strings, ...keys) {
    return (...values) => {
        const dict = values[values.length - 1] || {};
        const result = [strings[0]];
        keys.forEach((key, i) => {
            const value = Number.isInteger(key) ? values[key] : dict[key];
            result.push(value, strings[i + 1]);
        });
        return result.join("");
    };
}

/**
 * Capitalize each word in an array
 * @param {Array<string>} arr
 * @return {Array<string>}
 */
function capitalizeWords(arr) {
    return arr.map(word => capitalizeWord(word));
}


/**
 * Capitalize the first letter in a word
 * @param {string} word
 * @return {string}
 */
function capitalizeWord(word) {
    return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
}

/**
 * Get the base component of a path
 * @param {string} fullPath
 * @return {string}
 */
function basename(fullPath) {
    let base = fullPath.substring(fullPath.lastIndexOf("/") + 1);
    if (base.lastIndexOf(".") != -1) base = base.substring(0, base.lastIndexOf("."));
    return base;
}

/**
 * Creates a text-based progress bar.
 * The function generates a progress bar string based on the provided numerator and denominator.
 * It fills the progress bar proportional to the percentage completion (numerator/denominator).
 * The progress bar is constructed with a specified size (total number of characters) and can
 * include an optional label.
 * @param {number} numerator - The current progress value.
 * @param {number} denominator - The total value representing 100% progress.
 * @param {number} size - The total length of the progress bar in characters.
 * @param {string} label - A label for the progress bar.
 * @return {string} A string representing the progress bar with the current percentage and progress values.
 */
function makeProgressBar(numerator, denominator, size, label) {
    const filledChar = "█";
    const unfilledChar = "◽";
    const percentage = numerator / denominator;
    const maxBlocks = size;
    const numFilled = Math.floor(percentage * maxBlocks);
    return `${label}: [${filledChar.repeat(numFilled)}${unfilledChar.repeat(maxBlocks - numFilled)}] ${Math.floor(percentage * 100)}% ( ${numerator}/${denominator} )`;
}

/**
 * Creates a markdown link with metadata.
 *
 * @param {string} key - The key to be prepended to the markdown link.
 * @param {Object} page - An object containing information about the page.
 * It should have a 'file' property with a 'path' subproperty and an 'aliases' array.
 * @return {string} A string in the format "key:: [[markdownLink|alias]]" where markdownLink
 * is generated from file path, and alias is taken from the first element of aliases array
 * in page object.
 *
 */
function createMetaMarkdownLink(key, page) {
    const file = app.vault.getAbstractFileByPath(page.file.path);
    let markdownLink = app.fileManager.generateMarkdownLink(file, "");
    markdownLink = `${markdownLink.slice(0, markdownLink.length - 2)}|${page.aliases[0]}${markdownLink.slice(markdownLink.length - 2)}`;
    return `${key}:: ${markdownLink}`;
}

/**
 * Transforms text into a consitent filename.
 * All characters are lowercased and words separated by dashes.
 * @param {string} text - Text to transform into a filename.
 * @return {string} - The text suitable for use as a filename.
 */
function textToFilename(text) {
    return sanitizeText(text)
        .replace(/ /g, "-").toLowerCase()
        .replace(/[--]+/g, "-");
}

/**
 * Sanitizes the given text, removing unwanted characters.
 * @param {string} text - The text to sanitize.
 * @return {string} - The sanitized text, lowercased.
 */
function sanitizeText(text) {
    return text.replace(illegalCharacterRegex, "").toLowerCase();
}

/**
 * Retrieves all the folder paths from a given vault.
 * Yoinked from https://github.com/chhoumann/quickadd/blob/master/src/engine/TemplateEngine.ts
 * @param {object} tp - The templater tp object.
 * @return {Array<string>} - An array of strings representing the folder paths.
*/
function getAllFolderPathsInVault(tp) {
    return app.vault
        .getAllLoadedFiles()
        .filter(f => f instanceof tp.obsidian.TFolder)
        .map(folder => folder.path);
}

/**
 * Gets or creates a folder based on the given folders array.
 * Yoinked from https://github.com/chhoumann/quickadd/blob/master/src/engine/TemplateEngine.ts
 * @param {object} tp - The templater tp object.
 * @param {Array<string>} folders - An array of strings representing the folders.
 * @throws Will throw an error if no folder is selected from suggester.
 * @return {Promise<string>} A promise that resolves to the path of the selected or created folder.
 */
async function getOrCreateFolder(tp, folders) {
    let folderPath;

    if (folders.length > 1) {
        folderPath = await tp.system.suggester(folders, folders, false, "Select (or create) folder");
        if (!folderPath) throw new Error("No folder selected.");
    } else {
        folderPath = folders[0];
    }
    await createFolder(folderPath);
    return folderPath;
}

/**
 * Checks if a folder exists in the vault and creates it if not.
 * Yoinked from https://github.com/chhoumann/quickadd/blob/master/src/engine/TemplateEngine.ts
 * @param {string} folder - The path of the folder to create.
 */
async function createFolder(folder) {
    const folderExists = await this.app.vault.adapter.exists(folder);

    if (!folderExists)
        await this.app.vault.createFolder(folder);
}

/**
 * Present a suggester of files based on a given search term.
 * @param {object} dv - The dataview object.
 * @param {object} tp - The templater object.
 * @param {string} searchTerm - Term to search for in pages.
 * @param {string} message - Message to display in suggester prompt.
 * @throws Will throw an error if unable to fetch pages or suggest files.
 * @return {Promise<object>} A promise that resolves with the suggested file object.
 */
async function suggestFiles(dv, tp, searchTerm, message) {
    const pages = dv.pages(searchTerm)
        .where(p => !p.file.path.includes("template"))
        .sort(p => p.file.mtime, "desc").values;
    return await tp.system.suggester(
        p => p.file.aliases.length ? p.file.aliases[0] : p.file.basename, pages, false, message);
}

/**
 * Present a suggester of template files based on a given search term.
 *
 * @param {object} dv - The dataview object.
 * @param {object} tp - The templater object.
 * @param {string} searchTerm - Term to search for in pages.
 * @param {string} message - Message to display in suggester prompt.
 * @return {Promise<object>} A promise that resolves with the suggested file object.
 */
async function suggestTemplateFiles(dv, tp, searchTerm, message) {
    const pages = dv.pages(searchTerm)
        .where(p => p.file.path.includes("template"))
        .sort(p => p.file.mtime, "desc").values;
    return await tp.system.suggester(p => p.file.basename, pages, false, message);
}

module.exports = newNoteData;
