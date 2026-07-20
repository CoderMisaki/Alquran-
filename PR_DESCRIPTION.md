Title: 🧪 Add non-array input test for filterSurahsBySearch

Description:
* 🎯 **What:** Addressed a testing gap where `filterSurahsBySearch` wasn't explicitly verified to handle non-array inputs safely.
* 📊 **Coverage:** Added test cases for passing `null` and `undefined` as the `surahs` parameter.
* ✨ **Result:** Ensures the function successfully falls back to an empty array for non-array inputs, preventing potential `TypeError`s when the function attempts to call `.filter()` on undefined or null values. The codebase is now safer and more robust.
