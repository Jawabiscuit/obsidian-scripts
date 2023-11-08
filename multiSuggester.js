/**
 * Spawns a multi-select suggester prompt and returns the user's chosen items.
 * @param {object} tp Templater tp object.
 * @param {string[] | ((item: T) => string)} textItems Array of strings representing the text that will be displayed for each item in the suggester prompt. This can also be a function that maps an item to its text representation.
 * @param {T[]} items Array containing the values of each item in the correct order.
 * @param {boolean} throwOnCancel Throws an error if the prompt is canceled, instead of returning a null value.
 * @param {string} placeholder Placeholder string of the prompt.
 * @param {number} limit Limit the number of items rendered at once (useful to improve performance when displaying large lists).
 * @returns A list of selected items.
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
    switch(sort) {
        // Sorted alphabetically
        case "alpha":
            items = items.sort( (a, b) => a[0].localeCompare(b[0]) )
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
    if (sort === "occurance") {
        items = items.sort( (a, b) => b[1] - a[1], "desc" );
    }
    // Looping to keep suggester modal open until escape is hit
    while (true) {
      const selectedItem = await tp.system.suggester(
        textItems,
        items,
        throwOnCancel,
        placeholder,
        limit
      );
      // If escape is hit, break out of loop to close suggester modal
      if (!selectedItem) {
        break;
      }
      // Hack to create a new item
      if (selectedItem[0] === "-- New --") {
        newTag = await tp.system.prompt("New tag");
        selectedItems.push([`#${newTag}`, 0]);
        continue;
      }

      // Otherwise, add selected item to list of selected items, remove item from multi-select, and keep looping
      selectedItems.push(selectedItem);
      const selectedItemIndex = items.findIndex((item) => item === selectedItem);
      if (selectedItemIndex >= 0) {
        items.splice(selectedItemIndex, 1);
        if (Array.isArray(textItems)) {
          textItems.splice(selectedItemIndex, 1);
        }
      }
    }
  
    return selectedItems;
  }
  
  module.exports = multiSuggester;