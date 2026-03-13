import React, { useState, useEffect } from "react";
import Web3 from "web3";
import axios from "axios";
import SupplyChainABI from "./artifacts/SupplyChain.json";
import { useHistory } from "react-router-dom";

function AssignRoles() {
    const history = useHistory();

    const [currentaccount, setCurrentaccount] = useState("");
    const [loader, setLoader] = useState(true);
    const [SupplyChain, setSupplyChain] = useState();

    // Participant lists
    const [RMS, setRMS] = useState({});
    const [MAN, setMAN] = useState({});
    const [DIS, setDIS] = useState({});
    const [RET, setRET] = useState({});

    // RMS input
    const [RMSname, setRMSname] = useState("");
    const [RMSplace, setRMSplace] = useState("");
    const [RMSaddress, setRMSaddress] = useState("");
    const [RMSmaterials, setRMSmaterials] = useState("");

    // Manufacturer input
    const [MANname, setMANname] = useState("");
    const [MANplace, setMANplace] = useState("");
    const [MANaddress, setMANaddress] = useState("");
    const [MANproducts, setMANproducts] = useState("");

    // Distributor input
    const [DISname, setDISname] = useState("");
    const [DISplace, setDISplace] = useState("");
    const [DISaddress, setDISaddress] = useState("");
    const [DISfragile, setDISfragile] = useState(false);

    // Retailer input
    const [RETname, setRETname] = useState("");
    const [RETplace, setRETplace] = useState("");
    const [RETaddress, setRETaddress] = useState("");

    useEffect(() => {
        loadWeb3();
        loadBlockchainData();
    }, []);

    // -----------------------------
    // WEB3 + CONTRACT SETUP
    // -----------------------------
    const loadWeb3 = async () => {
        if (window.ethereum) {
            window.web3 = new Web3(window.ethereum);
            await window.ethereum.enable();
        } else if (window.web3) {
            window.web3 = new Web3(window.web3.currentProvider);
        } else {
            window.alert("Please install MetaMask!");
        }
    };

    const loadBlockchainData = async () => {
        setLoader(true);
        const web3 = window.web3;
        const accounts = await web3.eth.getAccounts();
        setCurrentaccount(accounts[0]);
        const networkId = await web3.eth.net.getId();
        const networkData = SupplyChainABI.networks[networkId];

        if (networkData) {
            const supplychain = new web3.eth.Contract(SupplyChainABI.abi, networkData.address);
            setSupplyChain(supplychain);

            const rmsCtr = await supplychain.methods.rmsCtr().call();
            const manCtr = await supplychain.methods.manCtr().call();
            const disCtr = await supplychain.methods.disCtr().call();
            const retCtr = await supplychain.methods.retCtr().call();

            const rms = {};
            for (let i = 0; i < rmsCtr; i++) {
                const r = await supplychain.methods.getRMS(i + 1).call();
                rms[i] = {
                    id: r.id,
                    name: r.name,
                    place: r.place,
                    addr: r.addr,
                    materials: r.materials || [],
                };
            }

            const man = {};
            for (let i = 0; i < manCtr; i++) {
                const m = await supplychain.methods.getManufacturer(i + 1).call();
                man[i] = {
                    id: m.id,
                    name: m.name,
                    place: m.place,
                    addr: m.addr,
                    availableProducts: m.availableProducts || [],
                };
            }

            const dis = {};
            for (let i = 0; i < disCtr; i++) {
                const d = await supplychain.methods.getDistributor(i + 1).call();
                dis[i] = {
                    id: d.id,
                    name: d.name,
                    place: d.place,
                    addr: d.addr,
                    canDeliverFragile: d.canDeliverFragile,
                };
            }

            const ret = {};
            for (let i = 0; i < retCtr; i++) {
                ret[i] = await supplychain.methods.RET(i + 1).call();
            }

            setRMS(rms);
            setMAN(man);
            setDIS(dis);
            setRET(ret);
            setLoader(false);
        } else {
            window.alert("Smart contract not deployed to this network.");
        }
    };

    // -----------------------------
    // UTILITIES
    // -----------------------------
    const redirect_to_home = () => history.push("/home");

    const handlerChange = (setter) => (event) => setter(event.target.value);

    // -----------------------------
    // HANDLERS — ADD PARTICIPANTS
    // -----------------------------
    const handlerSubmitRMS = async (e) => {
        e.preventDefault();
        const materialsArray = RMSmaterials.split(",").map((m) => m.trim()).filter((m) => m);
        try {
            const receipt = await SupplyChain.methods
                .addRMS(RMSaddress, RMSname, RMSplace, materialsArray)
                .send({ from: currentaccount });

            if (receipt) {
                await axios.post("http://localhost:5002/api/participants", {
                    role: "RMS",
                    name: RMSname,
                    place: RMSplace,
                    address: RMSaddress,
                    materials: materialsArray,
                    blockchainTx: receipt.transactionHash,
                });
                loadBlockchainData();
            }
        } catch (err) {
            console.error(err);
            alert("Error adding RMS!");
        }
    };

    const handlerSubmitMAN = async (e) => {
        e.preventDefault();
        const productsArray = MANproducts.split(",").map((p) => p.trim()).filter((p) => p);
        try {
            const receipt = await SupplyChain.methods
                .addManufacturer(MANaddress, MANname, MANplace, productsArray)
                .send({ from: currentaccount });

            if (receipt) {
                await axios.post("http://localhost:5002/api/participants", {
                    role: "MAN",
                    name: MANname,
                    place: MANplace,
                    address: MANaddress,
                    availableProducts: productsArray,
                    blockchainTx: receipt.transactionHash,
                });
                loadBlockchainData();
            }
        } catch (err) {
            console.error(err);
            alert("Error adding Manufacturer!");
        }
    };

    const handlerSubmitDIS = async (e) => {
        e.preventDefault();
        try {
            const receipt = await SupplyChain.methods
                .addDistributor(DISaddress, DISname, DISplace, DISfragile)
                .send({ from: currentaccount });

            if (receipt) {
                await axios.post("http://localhost:5002/api/participants", {
                    role: "DIS",
                    name: DISname,
                    place: DISplace,
                    address: DISaddress,
                    canDeliverFragile: DISfragile,
                    blockchainTx: receipt.transactionHash,
                });
                loadBlockchainData();
            }
        } catch (err) {
            console.error(err);
            alert("Error adding Distributor!");
        }
    };

    const handlerSubmitRET = async (e) => {
        e.preventDefault();
        try {
            const receipt = await SupplyChain.methods
                .addRetailer(RETaddress, RETname, RETplace)
                .send({ from: currentaccount });

            if (receipt) {
                await axios.post("http://localhost:5002/api/participants", {
                    role: "RET",
                    name: RETname,
                    place: RETplace,
                    address: RETaddress,
                    blockchainTx: receipt.transactionHash,
                });
                loadBlockchainData();
            }
        } catch (err) {
            console.error(err);
            alert("Error adding Retailer!");
        }
    };

    // -----------------------------
    // UI
    // -----------------------------
    if (loader) return <h2>Loading Blockchain Data...</h2>;

    return (
        <div className="container mt-3">
            <div className="mb-3">
                <b>Current Account:</b> {currentaccount}
                <button
                    onClick={redirect_to_home}
                    className="btn btn-outline-danger btn-sm float-end"
                >
                    HOME
                </button>
            </div>

            {/* --- RAW MATERIAL SUPPLIERS --- */}
            <h4>Raw Material Suppliers</h4>
            <form onSubmit={handlerSubmitRMS}>
                <input type="text" onChange={handlerChange(setRMSaddress)} placeholder="Ethereum Address" required className="form-control-sm" />
                <input type="text" onChange={handlerChange(setRMSname)} placeholder="Supplier Name" required className="form-control-sm" />
                <input type="text" onChange={handlerChange(setRMSplace)} placeholder="Based In" required className="form-control-sm" />
                <input type="text" onChange={handlerChange(setRMSmaterials)} placeholder="Materials (comma-separated)" required className="form-control-sm" />
                <button type="submit" className="btn btn-outline-success btn-sm">Register</button>
            </form>

            <table className="table table-sm mt-2">
                <thead>
                    <tr><th>ID</th><th>Name</th><th>Place</th><th>Address</th><th>Materials</th></tr>
                </thead>
                <tbody>
                    {Object.keys(RMS).map((key) => (
                        <tr key={key}>
                            <td>{RMS[key].id}</td>
                            <td>{RMS[key].name}</td>
                            <td>{RMS[key].place}</td>
                            <td>{RMS[key].addr}</td>
                            <td>{RMS[key].materials?.join(", ") || "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* --- MANUFACTURERS --- */}
            <h4>Manufacturers</h4>
            <form onSubmit={handlerSubmitMAN}>
                <input type="text" onChange={handlerChange(setMANaddress)} placeholder="Ethereum Address" required className="form-control-sm" />
                <input type="text" onChange={handlerChange(setMANname)} placeholder="Manufacturer Name" required className="form-control-sm" />
                <input type="text" onChange={handlerChange(setMANplace)} placeholder="Based In" required className="form-control-sm" />
                <input type="text" onChange={handlerChange(setMANproducts)} placeholder="Products (comma-separated)" required className="form-control-sm" />
                <button type="submit" className="btn btn-outline-success btn-sm">Register</button>
            </form>
            <table className="table table-sm mt-2">
                <thead><tr><th>ID</th><th>Name</th><th>Place</th><th>Address</th><th>Products</th></tr></thead>
                <tbody>
                    {Object.keys(MAN).map((key) => (
                        <tr key={key}>
                            <td>{MAN[key].id}</td>
                            <td>{MAN[key].name}</td>
                            <td>{MAN[key].place}</td>
                            <td>{MAN[key].addr}</td>
                            <td>{MAN[key].availableProducts?.join(", ") || "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* --- DISTRIBUTORS --- */}
            <h4>Distributors</h4>
            <form onSubmit={handlerSubmitDIS}>
                <input type="text" onChange={handlerChange(setDISaddress)} placeholder="Ethereum Address" required className="form-control-sm" />
                <input type="text" onChange={handlerChange(setDISname)} placeholder="Distributor Name" required className="form-control-sm" />
                <input type="text" onChange={handlerChange(setDISplace)} placeholder="Based In" required className="form-control-sm" />
                <label className="ms-2">
                    <input
                        type="checkbox"
                        checked={DISfragile}
                        onChange={(e) => setDISfragile(e.target.checked)}
                    />{" "}
                    Can Deliver Fragile Goods
                </label>
                <button type="submit" className="btn btn-outline-success btn-sm ms-2">Register</button>
            </form>
            <table className="table table-sm mt-2">
                <thead><tr><th>ID</th><th>Name</th><th>Place</th><th>Address</th><th>Can Deliver Fragile</th></tr></thead>
                <tbody>
                    {Object.keys(DIS).map((key) => (
                        <tr key={key}>
                            <td>{DIS[key].id}</td>
                            <td>{DIS[key].name}</td>
                            <td>{DIS[key].place}</td>
                            <td>{DIS[key].addr}</td>
                            <td>{DIS[key].canDeliverFragile ? "Yes" : "No"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* --- RETAILERS --- */}
            <h4>Retailers</h4>
            <form onSubmit={handlerSubmitRET}>
                <input type="text" onChange={handlerChange(setRETaddress)} placeholder="Ethereum Address" required className="form-control-sm" />
                <input type="text" onChange={handlerChange(setRETname)} placeholder="Retailer Name" required className="form-control-sm" />
                <input type="text" onChange={handlerChange(setRETplace)} placeholder="Based In" required className="form-control-sm" />
                <button type="submit" className="btn btn-outline-success btn-sm">Register</button>
            </form>
            <table className="table table-sm mt-2">
                <thead><tr><th>ID</th><th>Name</th><th>Place</th><th>Address</th></tr></thead>
                <tbody>
                    {Object.keys(RET).map((key) => (
                        <tr key={key}>
                            <td>{RET[key].id}</td>
                            <td>{RET[key].name}</td>
                            <td>{RET[key].place}</td>
                            <td>{RET[key].addr}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default AssignRoles;
