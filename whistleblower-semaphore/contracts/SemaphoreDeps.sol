// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Semaphore} from "@semaphore-protocol/contracts/Semaphore.sol";
import {SemaphoreVerifier} from "@semaphore-protocol/contracts/base/SemaphoreVerifier.sol";
import {ISemaphoreVerifier} from "@semaphore-protocol/contracts/interfaces/ISemaphoreVerifier.sol";

contract LocalSemaphoreVerifier is SemaphoreVerifier {}

contract LocalSemaphore is Semaphore {
    constructor(ISemaphoreVerifier verifier) Semaphore(verifier) {}
}
