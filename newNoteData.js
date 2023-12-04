const BASE_NOTE_TYPES = [
    "reference",
    "meeting",
    "project",
    "goal",
    "chat",
]

const PERIODIC_TYPES = [
    "journal",
    "daily",
    "weekly",
    "monthly",
    "quarterly",
    "yearly",
]

const DEFAULT_NO_TO_TASKS = [
    "weekly",
    "monthly",
    "quarterly",
    "yearly",
    "reference",
]

const DEFAULT_DONT_ASK_STATUS = [
    "chat",
    "reference",
]

const DEFAULT_DONT_ASK_TASKS = [
    "chat",
]

const DEFAULT_DONT_ASK_ATTACHMENTS = [
    "chat",
]

const DEFAULT_ASK_ASSOC_PROJECT = [
    "chat",
    "journal",
    "meeting",
    "reference",
]

const resourceTClosure = template`resource::\`$= dv.view("section", {file: "${'t'}", searchTerm: "reference", headerName: "Resource", headerNamePlural: "Resources", icon: "🔗", list: true})\``;
const journalTClosure = template`journal::\`$= dv.view("section", {file: "${'t'}", searchTerm: "journal", headerName: "Journal", headerNamePlural: "Journals", icon: "📓"})\``;

/**
 * Prompts the user for default values and initializes variables.
 * @param {object} tp Templater tp object.
 * @param {object} dv Dataview dv object.
 * @returns An object of key value pairs.
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
        let folders = getAllFolderPathsInVault(tp);
        folderPath = await getOrCreateFolder(tp, folders);
        title = tp.date.now("YYYY-MM-DD") + "-" + title.toLowerCase();
        title = await tp.system.prompt("Title", title);
        if (folderPath !== folder) {
            await tp.file.move(folderPath + "/" + title);
            folder = folderPath;
        }
    }

    title = qcFileName(title);
    if (title !== tp.file.title) {
        await tp.file.rename(title)
    }

    const fileDateISO = tp.date.now("YYYY-MM-DD", 0, title, "YYYY-MM-DD");
    const fileDate = moment(fileDateISO).format(dateFmt);
    let titleWODate = title.split(fileDateISO + "-")[1];

    const dirname = basename(folder);
    const types = BASE_NOTE_TYPES.concat(PERIODIC_TYPES)

    for (let t of types) {
        if (dirname == t) {
            type = t;
        }
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
            if (answer == "y") {
                series = true;
            }
            break;
        default:
            if (!type) new Notice("Undefined note type", 5000);
            series = false;
    }

    let aliases = [];
    const alias = await tp.system.prompt(
        "♊ Alias",
        titleWODate ? capitalizeWords(titleWODate.split("-")).join(" ") :
        fileDate + " " + capitalizeWord(type) + " Note"
    );
    aliases.push(alias)

    let subtitle;
    if (type == "goal") {
        subtitle = await tp.system.prompt(
        "🔱 Reason", alias.replace(fileDate + " ", "").toLowerCase());
    } else {
        subtitle = await tp.system.prompt(
        "🔱 Subtitle", alias.replace(fileDate + " ", "").toLowerCase());
    }

    const statuses = {
        "todo": "todo",
        "waiting": "wtg",
        "in-progress": "ip",
        "finished": "fin",
        "hold": "hld",
        "complete": "cmpt",
        "blocked": "blkd",
        "n/a": "na"
    };

    let status = !DEFAULT_DONT_ASK_STATUS.includes(type) ? await
        tp.system.suggester(
            Object.keys(statuses),
            Object.values(statuses),
            false,
            "Enter status"
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
    if (goal) {
        goalMeta = createMetaMarkdownLink("goal", goal);
    }

    let project;
    if (DEFAULT_ASK_ASSOC_PROJECT.includes(type)){
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
    if (project) {
        projectMeta = createMetaMarkdownLink("project", project);
    }

    cached = app.metadataCache.getTags();
    cached["-- New --"] = 9999;
    const allTags = Object.entries(cached);
    // Add the note type automatically
    // Don't allow it to show in list of choices
    const typeIndex = allTags.findIndex((item) => item[0] === `#${type}`);

    function tagFound() {
        return typeIndex >= 0
    }

    let removedItem;
    if (typeIndex >= 0) {
        removedItem = allTags.splice(typeIndex, 1)[0];
    }
    const selectedTags = !isPeriodicNoteType(type) ? await tp.user.multiSuggester(
        tp,
        t => t[0].replace("#", ""),
        allTags,
        false,
        "Choose tags (Enter to make new, ESC when finished)",
        undefined,
        "occurance"
    ) : [];
    // Put the note type back onto the list of tags
    if (!selectedTags.includes(removedItem)) {
        selectedTags.unshift(removedItem);
    }
    let newTag;
    // Tag for periodic note has not been created
    if (!tagFound() && isPeriodicNoteType(type)) {
        newTag = type;
    }

    let tags;
    if (tagFound()) {
        tags = selectedTags.map(t => t[0].replace("#", ""));
    } else if (newTag) {
        tags = [newTag];
    }

    if (tags.includes("book"))
        status = await tp.system.suggester(Object.keys(statuses), Object.values(statuses), false, "Enter status");

    let dailyProgress;
    if (["daily", "journal"].includes(type)) {
        const thisDate = new Date(fileDateISO + "T00:00");
        if (tags.includes("work")) {
            // 5 workdays
            dailyProgress = makeProgressBar(thisDate.getDay(), 5, size=5, label="Progress");
        } else {
            // 7 weekdays
            dailyProgress = makeProgressBar(thisDate.getDay(), 7, size=7, label="Progress");
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
        if (tags.includes("book")) {
            includeFile = await tp.file.include("[[book]]");
        } else {
            includeFile = await tp.file.include("[[reference]]");
        }
    }

    let nav;
    if (series) {
        nav = 'nav::`$= dv.view("navigation", {file: "' + title + '"})`';
    }

    let taskProgress;
    if (DEFAULT_DONT_ASK_TASKS.includes(type)) {
        answer = null;
    } else if (DEFAULT_NO_TO_TASKS.includes(type)) {
        answer = await tp.system.prompt("Track progress using tasks? (\"y/N\")", "n");
    } else {
        answer = await tp.system.prompt("Track progress using tasks? (\"Y/n\")", "y");
    }
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
        taskProgress = 'bar::`$= dv.view("' + progressView + '", {file: "' + title + '"})`';
    }

    let journalView;
    let resourceView;
    let projectDataView;

    if (type == "project") {
        projectDataView = 'project-dv::`$= dv.view("project-dv", {file: "' + title + '"})`';
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
        let choices = [
            "10 Years", "5 Years", "3 Years", "1 Year", "6 Months",
            "3 Months", "1 Month", "1 Week",
        ]
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
    if (DEFAULT_DONT_ASK_ATTACHMENTS.includes(type)) {
        answer = null;
    } else {
        answer = await tp.system.prompt("Include attachment? (\"y/N\")", "n");
    }
    if (answer == "y") {
        const files = app.vault.getFiles()
            .filter(f => f.path.includes("attachments/") && ["png", "jpg"].includes(f.extension))
            .sort(f => f.ctime, "desc");
        const pickedImg = await tp.system.suggester((file) => file.basename, files)
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
    }
}

/**
 * Helper Functions
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

function log(msg) {
    console.log(msg);
}

function capitalizeWords(arr) {
    return arr.map(word => capitalizeWord(word));
}

function capitalizeWord(word) {
    return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase()
}

function basename(fullPath) {
    let base = fullPath.substring(fullPath.lastIndexOf("/") + 1);
    if (base.lastIndexOf(".") != -1) base = base.substring(0, base.lastIndexOf("."));
    return base;
}

function makeProgressBar(numerator, denominator, size, label) {
    const filled_char = "█"
    const unfilled_char = "◽"
    let percentage = numerator / denominator;
    let max_blocks = size;
    let num_filled = Math.floor(percentage * max_blocks);
    return `${label}: [${filled_char.repeat(num_filled)}${unfilled_char.repeat(max_blocks - num_filled)}] ${Math.floor(percentage * 100)}% ( ${numerator}/${denominator} )`
}

function createMetaMarkdownLink(key, page) {
    const file = app.vault.getAbstractFileByPath(page.file.path);
    let markdownLink = app.fileManager.generateMarkdownLink(file, "");
    markdownLink = `${markdownLink.slice(0, markdownLink.length - 2)}|${page.aliases[0]}${markdownLink.slice(markdownLink.length - 2)}`;
    return `${key}:: ${markdownLink}`;
}

function qcFileName(fileName) {
    var qcFileName = fileName.replace(/:/g, "-");
    qcFileName = qcFileName.replace(/\?|\!|\||#|‘|’/g, "");
    qcFileName = qcFileName.replace(/ /g, "-");
    return qcFileName.toLowerCase();
}

function isPeriodicNoteType(type) {
    return PERIODIC_TYPES.includes(type);
}

/** Yoinked from https://github.com/chhoumann/quickadd/blob/master/src/engine/TemplateEngine.ts */
function getAllFolderPathsInVault(tp) {
    return app.vault
    .getAllLoadedFiles()
    .filter((f) => f instanceof tp.obsidian.TFolder)
    .map((folder) => folder.path);
}

/** Yoinked from https://github.com/chhoumann/quickadd/blob/master/src/engine/TemplateEngine.ts */
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

/** Yoinked from https://github.com/chhoumann/quickadd/blob/master/src/engine/TemplateEngine.ts */
async function createFolder(folder) {
    const folderExists = await this.app.vault.adapter.exists(folder);

    if (!folderExists) {
        await this.app.vault.createFolder(folder);
    }
}

async function suggestFiles(dv, tp, searchTerm, msg) {
    const pages = dv.pages(searchTerm)
        .where(p => !p.file.path.includes("template"))
        .sort(p => p.file.mtime, "desc").values;
    return await tp.system.suggester(
        p => p.file.aliases.length ? p.file.aliases[0] : p.file.basename, pages, false, msg);
}

async function suggestTemplateFiles(dv, tp, searchTerm, msg) {
    const pages = dv.pages(searchTerm)
        .where(p => p.file.path.includes("template"))
        .sort(p => p.file.mtime, "desc").values;
    return await tp.system.suggester(p => p.file.basename, pages, false, msg);
}

module.exports = newNoteData;