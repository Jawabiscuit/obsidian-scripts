/**
 * Original: https://zachyoung.dev/posts/templater-multi-select-suggester
 * JA - Added sorting and ability to append new tags
 */

/**
 * Spawns a multi-select suggester prompt and returns the user's chosen items.
 * @template T The type of items in the array.
 * @param {object} tp Templater tp object.
 * @param {string[]} textItems Array of strings or function
 * that maps an item to its text representation for each item in the suggester prompt.
 * @param {string[]} items Array containing values of each item in correct order.
 * @param {boolean} throwOnCancel If true, throws error if prompt is canceled instead
 * of returning null.
 * @param {string} placeholder Placeholder string for the prompt.
 * @param {number} limit Limit on number of items rendered at once (improves performance
 * when displaying large lists).
 * @param {string} sort Sorts list alphabetically ("alpha"), by occurrence descending
 * ("occurrence"), or by occurrence ascending ("occurrence|asc").
 * @return {T[]} A list of selected 'items' based on user input from suggester prompt.
 */
async function multiSuggester(
    tp,
    textItems,
    items,
    throwOnCancel = false,
    placeholder = "",
    limit = undefined,
    sort = "",
) {
    // List of items that are selected in the suggester
    const selectedItems = [];
    switch (sort) {
        // Sorted alphabetically
        case "alpha":
            items = items.sort( (a, b) => a[0].localeCompare(b[0]) );
            break;
        // Sorted by occurance
        case "occurance":
            items = items.sort( (a, b) => b[1] - a[1], "desc" );
            break;
        // Sorted by occurance ascending
        case "occurance|asc":
            items = items.sort( (a, b) => b[1] - a[1], "asc" );
            break;
    }
    // Looping to keep suggester modal open until escape is pressed
    while (true) {
        const selectedItem = await tp.system.suggester(
            textItems,
            items,
            throwOnCancel,
            placeholder,
            limit,
        );
        // If escape is pressed, break out of loop to close suggester modal
        if (!selectedItem)
            break;

        // Hack to create a new item
        if (selectedItem[0] === "-- New --") {
            value = await tp.system.prompt("New item");
            selectedItems.push([`#${value}`, 0]);
            continue;
        }

        // Otherwise, add selected item to list of selected items, remove item from multi-
        // select, and keep looping
        selectedItems.push(selectedItem);
        const selectedItemIndex = items.findIndex(item => item === selectedItem);
        if (selectedItemIndex >= 0) {
            items.splice(selectedItemIndex, 1);
            if (Array.isArray(textItems))
                textItems.splice(selectedItemIndex, 1);
        }

        if (!textItems.length)
            break;
    }

    return selectedItems;
}

module.exports = multiSuggester;
