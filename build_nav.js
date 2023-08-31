
function build_nav(prev, next) {
    nav = "◀ [[" + prev + "]] | [[" + next + "]] ▶";
    return nav;
}

module.exports = build_nav;
