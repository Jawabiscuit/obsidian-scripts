const PERIODIC_TYPES = [
    "journal",
    "daily",
    "weekly",
    "monthly",
    "quarterly",
    "yearly",
]
const DEFAULT_NO_TO_TASKS = [
    "daily",
    "weekly",
    "monthly",
    "quarterly",
    "yearly",
    "reference",
]

/**
 * Prompts the user for default values and initializes variables.
 * @param {object} tp Templater tp object.
 * @param {object} dv Dataview dv object.
 * @returns An object of key value pairs.
*/
async function newNoteData(tp, dv) {
    const fileDateISO = tp.date.now("YYYY-MM-DD", 0, tp.file.title, "YYYY-MM-DD");
    const titleWODate = tp.file.title.split(fileDateISO + "-")[1];
    const folder = tp.file.folder(relative=true);
    const dateFmt = "ddd Do MMM";
    const fileDate = moment(fileDateISO).format(dateFmt);

    let type;
    let series;

    var answer;

    const title = qcFileName(tp.file.title);
    if (title !== tp.file.title) await tp.file.rename(title)

    const dirname = basename(folder);
    const types = [
        "reference",
        "meeting",
    ].concat(PERIODIC_TYPES)

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
    if (titleWODate !== "") aliases.push(titleWODate)

    subtitle = await tp.system.prompt(
        "🔱 Subtitle", alias.replace(fileDate + " ", "").toLowerCase()
    );

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

    const status = type != "reference" ? await
        tp.system.suggester(
            Object.keys(statuses),
            Object.values(statuses),
            false,
            "Enter status"
        ) : null;

    let project;
    if (["reference", "meeting", "journal"].includes(type)){
        answer = await tp.system.prompt("Associate project? (\"y/N\")", "n");
        if (answer == "y") {
            const projectNotes = dv.pages("#project")
                .filter(p => p.file.path.includes("projects/"))
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
    } else if (type == "reference") {
        includeFile = await tp.file.include("[[reference]]");
    }

    let nav;
    if (series) {
        nav = 'nav::`$= dv.view("navigation", {file: "' + title + '"})`';
    }

    let taskProgress;
    if (DEFAULT_NO_TO_TASKS.includes(type)) {
        answer = await tp.system.prompt("Track progress using tasks? (\"y/N\")", "n");
    } else {
        answer = await tp.system.prompt("Track progress using tasks? (\"Y/n\")", "y");
    }
    if (answer == "y") {
        taskProgress = 'bar::`$= dv.view("total-progress-bar", {file: "' + title + '"})`';
    }

    let image;
    answer = await tp.system.prompt("Include attachment? (\"y/N\")", "n");
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
    }
}

/**
 * Helper Functions
*/

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

module.exports = newNoteData;