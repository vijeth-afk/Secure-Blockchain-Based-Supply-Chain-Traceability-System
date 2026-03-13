// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
pragma experimental ABIEncoderV2;

contract SupplyChain {
    address public Owner;

    constructor() public {
        Owner = msg.sender;
    }

    modifier onlyByOwner() {
        require(msg.sender == Owner, "Not contract owner");
        _;
    }

    enum STAGE {
        Init,
        RawMaterialSupply,
        Manufacture,
        Distribution,
        Retail,
        sold
    }

    uint256 public medicineCtr = 0;
    uint256 public rmsCtr = 0;
    uint256 public manCtr = 0;
    uint256 public disCtr = 0;
    uint256 public retCtr = 0;

    struct medicine {
        uint256 id;
        string name;
        string description;
        uint256 RMSid;
        uint256 MANid;
        uint256 DISid;
        uint256 RETid;
        STAGE stage;
    }

    mapping(uint256 => medicine) public MedicineStock;

    struct rawMaterialSupplier {
        address addr;
        uint256 id;
        string name;
        string place;
        string[] materials;
    }

    mapping(uint256 => rawMaterialSupplier) public RMS;

    struct manufacturer {
        address addr;
        uint256 id;
        string name;
        string place;
        string[] availableProducts;
    }

    mapping(uint256 => manufacturer) public MAN;

    struct distributor {
        address addr;
        uint256 id;
        string name;
        string place;
        bool canDeliverFragile;
    }

    mapping(uint256 => distributor) public DIS;

    struct retailer {
        address addr;
        uint256 id;
        string name;
        string place;
    }

    mapping(uint256 => retailer) public RET;

    // ✅ FIX: Add getter function that returns the materials array properly
    function getRMS(uint256 _id)
        public
        view
        returns (
            address addr,
            uint256 id,
            string memory name,
            string memory place,
            string[] memory materials
        )
    {
        require(_id > 0 && _id <= rmsCtr, "Invalid RMS ID");
        rawMaterialSupplier storage supplier = RMS[_id];
        return (supplier.addr, supplier.id, supplier.name, supplier.place, supplier.materials);
    }

    // Add Raw Material Supplier
    function addRMS(
        address _address,
        string memory _name,
        string memory _place,
        string[] memory _materials
    ) public onlyByOwner {
        rmsCtr++;
        RMS[rmsCtr] = rawMaterialSupplier(_address, rmsCtr, _name, _place, _materials);
    }

    // Add Manufacturer
    function addManufacturer(
        address _address,
        string memory _name,
        string memory _place,
        string[] memory _availableProducts
    ) public onlyByOwner {
        manCtr++;
        MAN[manCtr] = manufacturer(_address, manCtr, _name, _place, _availableProducts);
    }

    // Add Distributor
    function addDistributor(
        address _address,
        string memory _name,
        string memory _place,
        bool _canDeliverFragile
    ) public onlyByOwner {
        disCtr++;
        DIS[disCtr] = distributor(_address, disCtr, _name, _place, _canDeliverFragile);
    }

    // Add Retailer
    function addRetailer(
        address _address,
        string memory _name,
        string memory _place
    ) public onlyByOwner {
        retCtr++;
        RET[retCtr] = retailer(_address, retCtr, _name, _place);
    }

    // Helper Functions
    function findRMS(address _address) private view returns (uint256) {
        for (uint256 i = 1; i <= rmsCtr; i++) {
            if (RMS[i].addr == _address) return RMS[i].id;
        }
        return 0;
    }

    function findMAN(address _address) private view returns (uint256) {
        for (uint256 i = 1; i <= manCtr; i++) {
            if (MAN[i].addr == _address) return MAN[i].id;
        }
        return 0;
    }

    function findDIS(address _address) private view returns (uint256) {
        for (uint256 i = 1; i <= disCtr; i++) {
            if (DIS[i].addr == _address) return DIS[i].id;
        }
        return 0;
    }

    function findRET(address _address) private view returns (uint256) {
        for (uint256 i = 1; i <= retCtr; i++) {
            if (RET[i].addr == _address) return RET[i].id;
        }
        return 0;
    }

    // Medicine process flow
    function RMSsupply(uint256 _medicineID) public {
        require(_medicineID > 0 && _medicineID <= medicineCtr);
        uint256 _id = findRMS(msg.sender);
        require(_id > 0);
        require(MedicineStock[_medicineID].stage == STAGE.Init);
        MedicineStock[_medicineID].RMSid = _id;
        MedicineStock[_medicineID].stage = STAGE.RawMaterialSupply;
    }

    function Manufacturing(uint256 _medicineID) public {
        require(_medicineID > 0 && _medicineID <= medicineCtr);
        uint256 _id = findMAN(msg.sender);
        require(_id > 0);
        require(MedicineStock[_medicineID].stage == STAGE.RawMaterialSupply);
        MedicineStock[_medicineID].MANid = _id;
        MedicineStock[_medicineID].stage = STAGE.Manufacture;
    }

    function Distribute(uint256 _medicineID) public {
        require(_medicineID > 0 && _medicineID <= medicineCtr);
        uint256 _id = findDIS(msg.sender);
        require(_id > 0);
        require(MedicineStock[_medicineID].stage == STAGE.Manufacture);
        MedicineStock[_medicineID].DISid = _id;
        MedicineStock[_medicineID].stage = STAGE.Distribution;
    }

    function Retail(uint256 _medicineID) public {
        require(_medicineID > 0 && _medicineID <= medicineCtr);
        uint256 _id = findRET(msg.sender);
        require(_id > 0);
        require(MedicineStock[_medicineID].stage == STAGE.Distribution);
        MedicineStock[_medicineID].RETid = _id;
        MedicineStock[_medicineID].stage = STAGE.Retail;
    }

    function sold(uint256 _medicineID) public {
        require(_medicineID > 0 && _medicineID <= medicineCtr);
        uint256 _id = findRET(msg.sender);
        require(_id > 0);
        require(_id == MedicineStock[_medicineID].RETid);
        require(MedicineStock[_medicineID].stage == STAGE.Retail);
        MedicineStock[_medicineID].stage = STAGE.sold;
    }

    function addMedicine(string memory _name, string memory _description) public onlyByOwner {
        require((rmsCtr > 0) && (manCtr > 0) && (disCtr > 0) && (retCtr > 0));
        medicineCtr++;
        MedicineStock[medicineCtr] = medicine(
            medicineCtr,
            _name,
            _description,
            0,
            0,
            0,
            0,
            STAGE.Init
        );
    }

    function getManufacturer(uint256 _id)
        public
        view
        returns (
            address addr,
            uint256 id,
            string memory name,
            string memory place,
            string[] memory availableProducts
        )
    {
        require(_id > 0 && _id <= manCtr, "Invalid Manufacturer ID");
        manufacturer storage man = MAN[_id];
        return (man.addr, man.id, man.name, man.place, man.availableProducts);
    }

    function getDistributor(uint256 _id)
        public
        view
        returns (
            address addr,
            uint256 id,
            string memory name,
            string memory place,
            bool canDeliverFragile
        )
    {
        require(_id > 0 && _id <= disCtr, "Invalid Distributor ID");
        distributor storage dis = DIS[_id];
        return (dis.addr, dis.id, dis.name, dis.place, dis.canDeliverFragile);
    }

    function showStage(uint256 _medicineID) public view returns (string memory) {
        require(medicineCtr > 0);
        if (MedicineStock[_medicineID].stage == STAGE.Init) return "Goods Ordered";
        else if (MedicineStock[_medicineID].stage == STAGE.RawMaterialSupply)
            return "Raw Material Supply Stage";
        else if (MedicineStock[_medicineID].stage == STAGE.Manufacture)
            return "Manufacturing Stage";
        else if (MedicineStock[_medicineID].stage == STAGE.Distribution)
            return "Distribution Stage";
        else if (MedicineStock[_medicineID].stage == STAGE.Retail)
            return "Retail Stage";
        else if (MedicineStock[_medicineID].stage == STAGE.sold) return "Goods Sold";
    }
}
