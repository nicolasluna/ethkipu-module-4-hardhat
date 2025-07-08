// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Custom ERC20 Token Contract
/// @notice This contract allows minting of a custom ERC20 token.
contract CustomToken is ERC20 {

    /// @notice Deploys the ERC20 token with a given name and symbol.
    /// @param name Name of the token.
    /// @param symbol Symbol of the token.
    constructor(string memory name, string memory symbol) 
        ERC20(name, symbol) {
    }

    /// @notice Mints a specified amount of tokens to an address.
    /// @param to Address that will receive the minted tokens.
    /// @param amount Number of tokens to mint.
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

/// @title SimpleSwap Liquidity Pool
/// @notice A basic implementation of a decentralized exchange (DEX) similar to Uniswap.
contract SimpleSwap is ERC20 {
    /// @notice Address of Token A in the pool.
    IERC20 public tokenA;
    /// @notice Address of Token B in the pool.
    IERC20 public tokenB;

    /// @notice Current reserve of Token A.
    uint256 public reserveA;
    /// @notice Current reserve of Token B.
    uint256 public reserveB;

    /// @notice Deploys the SimpleSwap contract with tokenA and tokenB addresses.
    /// @param _tokenA Address of token A.
    /// @param _tokenB Address of token B.
    constructor(address _tokenA, address _tokenB) ERC20("LP Token", "LPT") {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    /// @notice Adds liquidity to the pool and mints LP tokens to the user.
    /// @param _tokenA Address of token A.
    /// @param _tokenB Address of token B.
    /// @param amountADesired Amount of token A user wants to deposit.
    /// @param amountBDesired Amount of token B user wants to deposit.
    /// @param amountAMin Minimum amount of token A accepted.
    /// @param amountBMin Minimum amount of token B accepted.
    /// @param to Address to receive LP tokens.
    /// @param deadline Timestamp after which the transaction is invalid.
    /// @return amountA Final amount of token A added.
    /// @return amountB Final amount of token B added.
    /// @return liquidity Amount of LP tokens minted.
    function addLiquidity(
        address _tokenA,
        address _tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(_tokenA == address(tokenA) && _tokenB == address(tokenB), "Invalid tokens");

        // calculate amounts with min amount
        (amountA, amountB) = _calculateAmounts(amountADesired, amountBDesired, amountAMin, amountBMin);

        // send tokens from user to this contract
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);

        // Uniswap version to calculate liquidity and then Mint LP tokens
        if (totalSupply() == 0) {
            liquidity = _sqrt(amountA * amountB);
        } else {
            liquidity = _min(
                (amountA * totalSupply()) / reserveA,
                (amountB * totalSupply()) / reserveB
            );
        }

        require(liquidity > 0, "Invalid liquidity");
        // mint LP Tokens
        _mint(to, liquidity);

        // Update reserves
        reserveA += amountA;
        reserveB += amountB;
    }
    
    /// @notice Internal helper to calculate correct amounts based on reserves.
    /// @param amountADesired Desired amount of token A.
    /// @param amountBDesired Desired amount of token B.
    /// @param amountAMin Minimum accepted amount of token A.
    /// @param amountBMin Minimum accepted amount of token B.
    /// @return amountA Final amount of token A to be used.
    /// @return amountB Final amount of token B to be used.
    function _calculateAmounts(
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal view returns (uint amountA, uint amountB) {
        if (reserveA == 0 && reserveB == 0) {
            amountA = amountADesired;
            amountB = amountBDesired;
        } else {
            uint amountBOptimal = (amountADesired * reserveB) / reserveA;
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "amountB too low");
                amountA = amountADesired;
                amountB = amountBOptimal;
            } else {
                uint amountAOptimal = (amountBDesired * reserveA) / reserveB;
                require(amountAOptimal >= amountAMin, "amountA too low");
                amountA = amountAOptimal;
                amountB = amountBDesired;
            }
        }
    }

    /// @notice Internal helper to compute minimum of two values.
    /// @param x First value.
    /// @param y Second value.
    /// @return The smaller of x and y.
    function _min(uint x, uint y) internal pure returns (uint) {
        return x < y ? x : y;
    }

    /// @notice Internal helper to compute square root of a value.
    /// @param y Value to compute the square root for.
    /// @return z The square root result.
    function _sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    /// @notice Removes liquidity from the pool and burns LP tokens.
    /// @param _tokenA Address of token A.
    /// @param _tokenB Address of token B.
    /// @param liquidity Amount of LP tokens to burn.
    /// @param amountAMin Minimum amount of token A expected.
    /// @param amountBMin Minimum amount of token B expected.
    /// @param to Address that will receive the tokens.
    /// @param deadline Timestamp after which the transaction is invalid.
    /// @return amountA Final amount of token A returned.
    /// @return amountB Final amount of token B returned.
    function removeLiquidity(
        address _tokenA, 
        address _tokenB, 
        uint liquidity, 
        uint amountAMin, 
        uint amountBMin, 
        address to, 
        uint deadline) 
    external returns (uint amountA, uint amountB) {
        require(_tokenA == address(tokenA) && _tokenB == address(tokenB), "Invalid tokens");
        require(block.timestamp <= deadline, "Transaction expired");
        require(liquidity > 0, "Invalid liquidity");
        require(amountBMin >= 0 && amountAMin >= 0, "Invalid amounts min");
        
        uint totalLPTokens = totalSupply();
        require(totalLPTokens > 0, "Invalid supply");

        // first multiply, then divide. Values to return
        amountA = (liquidity * reserveA) / totalLPTokens;
        amountB = (liquidity * reserveB) / totalLPTokens;

        require(amountA >= amountAMin, "amountA below min");
        require(amountB >= amountBMin, "amountB below min");

        // send tokens
        tokenA.transfer(to, amountA);
        tokenB.transfer(to, amountB);

        // burn LP tokens
        _burn(to, liquidity);

        // update reserves
        reserveA -= amountA;
        reserveB -= amountB;
    }

    /// @notice Swaps a fixed amount of token A for token B.
    /// @param amountIn Amount of input token to swap.
    /// @param amountOutMin Minimum output token amount accepted.
    /// @param path Array with two addresses: input token and output token.
    /// @param to Address that will receive the output tokens.
    /// @param deadline Timestamp after which the transaction is invalid.
    /// @return amounts Array of two elements: [amountIn, amountOut].
    function swapExactTokensForTokens(
        uint amountIn, 
        uint amountOutMin, 
        address[] calldata path, 
        address to, 
        uint deadline) 
    external returns (uint[] memory amounts) {
        require(amountIn > 0 && amountOutMin > 0, "Invalid amounts");
        require(block.timestamp <= deadline, "Transaction expired");
        require(path.length == 2, "Invalid tokens count");

        address tokenInAddr = path[0];
        address tokenOutAddr = path[1];

        //
        require((tokenInAddr == address(tokenA) && tokenOutAddr == address(tokenB)), "Invalid tokens");

        IERC20 inputToken = IERC20(tokenInAddr);
        IERC20 outputToken = IERC20(tokenOutAddr);

        uint256 reserveIn = reserveA;
        uint256 reserveOut = reserveB;

        uint256 amountIn256 = amountIn; // to resolve compilation error
        // send input token 
        inputToken.transferFrom(msg.sender, address(this), amountIn256);

        uint amountOut = (amountIn256 * reserveOut) / (reserveIn + amountIn256);
        require(amountOut >= amountOutMin, "Insufficient output amount");

        // send output token
        outputToken.transfer(to, amountOut);

        // update reserves
        reserveA += amountIn;
        reserveB -= amountOut;

        // return amounts
        amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }

    /// @notice Returns the current price of tokenB per tokenA.
    /// @param _tokenA Address of token A.
    /// @param _tokenB Address of token B.
    /// @return price Current price of tokenB per tokenA (scaled by 1e18).
    function getPrice(
        address _tokenA, 
        address _tokenB) 
    external view returns (uint price) {
        require(_tokenA == address(tokenA) && _tokenB == address(tokenB), "Invalid tokens");
        require(reserveA > 0 && reserveB > 0, "Invalid reserves");      
        price = (reserveB * 1e18) / reserveA;
    }

    /// @notice Calculates the output token amount based on input and reserves.
    /// @param amountIn Amount of input token.
    /// @param reserveIn Reserve of input token in the pool.
    /// @param reserveOut Reserve of output token in the pool.
    /// @return amountOut Calculated output token amount.
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint amountOut) {
        require(amountIn > 0, "Invalid amountIn");
        require(reserveIn > 0, "Invalid reserveIn");
        require(reserveOut > 0, "Invalid reserveOut");

        // from documentation
        amountOut = (amountIn * reserveOut) / (reserveIn + amountIn);
    }

}