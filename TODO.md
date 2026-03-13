# TODO: Add Materials Field to Raw Material Supplier

## Tasks
- [x] Update SupplyChain.sol: Add `string[] materials` to `rawMaterialSupplier` struct and modify `addRMS` function to accept materials parameter.
- [x] Update participantModel.js: Add `materials: [String]` to the schema.
- [x] Update AssignRoles.js: Add input field for materials in the RMS form, update submission to include materials, and update the table to display materials.
- [x] Redeploy smart contract after changes.
- [ ] Test the updated functionality.
