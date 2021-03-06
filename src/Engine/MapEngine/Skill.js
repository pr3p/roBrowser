/**
 * Engine/MapEngine/Skill.js
 *
 * Manage skills
 *
 * This file is part of ROBrowser, Ragnarok Online in the Web Browser (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

define(function( require )
{
	'use strict';


	/**
	 * Load dependencies
	 */
	var DB                   = require('DB/DBManager');
	var SkillId              = require('DB/SkillId');
	var Session              = require('Engine/SessionStorage');
	var Network              = require('Network/NetworkManager');
	var PACKET               = require('Network/PacketStructure');
	var ShortCut             = require('UI/Components/ShortCut/ShortCut');
	var ChatBox              = require('UI/Components/ChatBox/ChatBox');
	var SkillWindow          = require('UI/Components/SkillList/SkillList');
	var SkillTargetSelection = require('UI/Components/SkillTargetSelection/SkillTargetSelection');


	/**
	 * Failed to cast a skill
	 *
	 * @param {object} pkt - PACKET.ZC.ACK_TOUSESKILL
	 */
	function onSkillResult( pkt )
	{

		// Yeah success !
		if (pkt.success) {
			Session.Entity.setAction({
				action: Session.Entity.ACTION.SKILL,
				frame:  0,
				repeat: false,
				play:   true,
				next: {
					action: Session.Entity.ACTION.IDLE,
					frame: 0,
					repeat: true,
					play: true,
					next: false
				}
			});
			return;
		}

		// Fail
		Session.Entity.setAction({
			action: Session.Entity.ACTION.READYFIGHT,
			frame:  0,
			repeat: true,
			play:   true,
			next:   false
		});

		var error = 0;

		if (pkt.NUM) {
			switch (pkt.SKID) {

				default:
					error = 204;
					break;

				case SkillId.NV_BASIC:
					error = pkt.NUM < 7 ? 159 + pkt.NUM : pkt.NUM == 7 ? 383 : 0;
					break;

				case SkillId.AL_WARP:
					error = 214;
					break;

				case SkillId.TF_STEAL:
					error = 205;
					break;

				case SkillId.TF_POISON:
					error = 207;
					break;
			}
		}

		else {
			switch (pkt.cause) {
				case 1:  error = 202; break;
				case 2:  error = 203; break;
				case 3:  error = 808; break;
				case 4:  error = 219; break;
				case 5:  error = 233; break;
				case 6:  error = 239; break;
				case 7:  error = 246; break;
				case 8:  error = 247; break;
				case 9:  error = 580; break;
				case 10: error = 285; break;
				case 83: error = 661; break;
			}
		}

		if (error) {
			ChatBox.addText( DB.msgstringtable[error], ChatBox.TYPE.ERROR );
		}
	}


	/**
	 * List of skills
	 *
	 * @param {object} pkt - PACKET_ZC_SKILLINFO_LIST
	 */
	function onSkillList( pkt )
	{
		SkillWindow.setSkills( pkt.skillList );
	}


	/**
	 * Update a specified skill
	 *
	 * @param {object} pkt - PACKET.ZC.SKILLINFO_UPDATE
	 */
	function onSkillUpdate( pkt )
	{
		SkillWindow.updateSkill( pkt );
	}


	/**
	 * List of skills/items in hotkey
	 *
	 * @param {object} pkt - PACKET_ZC_SHORTCUT_KEY_LIST_V2
	 */
	function onShortCutList( pkt )
	{
		ShortCut.setList( pkt.ShortCutKey );
	}


	/**
	 * Add new skill to the list
	 *
	 * @param {object} pkt - PACKET.ZC.ADD_SKILL
	 */
	function onSkillAdded( pkt)
	{
		SkillWindow.addSkill( pkt );
	}


	/**
	 * Send back informations from server
	 * The user want to modify the shortcut
	 *
	 * @param {number} shortcut index
	 * @param {boolean|number} isSkill
	 * @param {number} ID
	 * @param {number} count / level
	 */
	ShortCut.onChange = function onChange( index, isSkill, ID, count )
	{
		var pkt                 = new PACKET.CZ.SHORTCUT_KEY_CHANGE();
		pkt.Index               = index;
		pkt.ShortCutKey.isSkill = isSkill ? 1 : 0;
		pkt.ShortCutKey.ID      = ID;
		pkt.ShortCutKey.count   = count;

		Network.sendPacket(pkt);
	};


	/**
	 * User want to level up a skill
	 *
	 * @param {number} skill id
	 */
	SkillWindow.onIncreaseSkill = function onIncreaseSkill( SKID )
	{
		var pkt  = new PACKET.CZ.UPGRADE_SKILLLEVEL();
		pkt.SKID = SKID;

		Network.sendPacket(pkt);
	};


	/**
	 * Cast a skill on someone
	 *
	 * @param {number} skill id
	 * @param {number} level
	 * @param {optional|number} target game id
	 */
	SkillWindow.onUseSkill = SkillTargetSelection.onUseSkillToId  = function onUseSkill( id, level, targetID)
	{
		var pkt = new PACKET.CZ.USE_SKILL();
		pkt.SKID          = id;
		pkt.selectedLevel = level;
		pkt.targetID      = targetID || Session.Entity.GID;

		Network.sendPacket(pkt);
	};



	/**
	 * Cast a skill on the ground
	 *
	 * @param {number} skill id
	 * @param {number} level
	 * @param {number} position x
	 * @param {number} position y
	 */
	SkillTargetSelection.onUseSkillToPos = function onUseSkillToPos(id, level, x, y)
	{
		var pkt = new PACKET.CZ.USE_SKILL_TOGROUND();
		pkt.SKID          = id;
		pkt.selectedLevel = level;
		pkt.xPos          = x;
		pkt.yPos          = y;

		Network.sendPacket(pkt);
	};


	/**
	 * Initialize
	 */
	return function SkillEngine()
	{
		Network.hookPacket( PACKET.ZC.SKILLINFO_LIST,       onSkillList );
		Network.hookPacket( PACKET.ZC.SKILLINFO_UPDATE,     onSkillUpdate );
		Network.hookPacket( PACKET.ZC.ADD_SKILL,            onSkillAdded );
		Network.hookPacket( PACKET.ZC.SHORTCUT_KEY_LIST,    onShortCutList );
		Network.hookPacket( PACKET.ZC.SHORTCUT_KEY_LIST_V2, onShortCutList );
		Network.hookPacket( PACKET.ZC.ACK_TOUSESKILL,       onSkillResult );
	};
});