# V2 comparison report

Candidate selection used validation data only. The final test was evaluated once after selection. All data is synthetic; results do not establish production validity.

```json
{
  "protocol": "v2_validation_only_selection_then_single_final_test",
  "synthetic_data": true,
  "base_model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
  "split_sizes": {
    "train": 40,
    "validation": 20,
    "test": 20
  },
  "leakage": {
    "family_overlap": [],
    "duplicate_pair_overlap": [],
    "shared_phrase_overlap": [],
    "near_duplicate_overlap": []
  },
  "settings": [
    {
      "name": "conservative",
      "epochs": 1,
      "learning_rate": 5e-06,
      "batch_size": 8
    },
    {
      "name": "moderate",
      "epochs": 1,
      "learning_rate": 1e-05,
      "batch_size": 8
    }
  ],
  "seeds": [
    13,
    42
  ],
  "baseline_validation": {
    "precision_exact": 1.0,
    "recall_exact": 0.9,
    "f1_exact": 0.9473684210526316,
    "macro_f1_three_class": 0.8221997300944669,
    "per_class": {
      "non_equivalent": {
        "precision": 1.0,
        "recall": 0.6,
        "f1": 0.75,
        "support": 5
      },
      "partial": {
        "precision": 0.625,
        "recall": 1.0,
        "f1": 0.7692307692307693,
        "support": 5
      },
      "equivalent": {
        "precision": 1.0,
        "recall": 0.9,
        "f1": 0.9473684210526315,
        "support": 10
      }
    },
    "confusion_matrix_rows_true_cols_predicted": [
      [
        3,
        2,
        0
      ],
      [
        0,
        5,
        0
      ],
      [
        0,
        1,
        9
      ]
    ],
    "similarity_by_relation": {
      "non_equivalent": {
        "mean": 0.32827383279800415,
        "values": [
          0.113542839884758,
          0.2937833070755005,
          0.23435860872268677,
          0.5135982036590576,
          0.48608607053756714
        ]
      },
      "partial": {
        "mean": 0.5048314332962036,
        "values": [
          0.6497367024421692,
          0.3964201807975769,
          0.34637314081192017,
          0.5822451710700989,
          0.5493819713592529
        ]
      },
      "equivalent": {
        "mean": 0.8739491701126099,
        "values": [
          0.9273765087127686,
          0.7014743089675903,
          0.6160253286361694,
          0.9786961078643799,
          0.96642005443573,
          0.9742590188980103,
          0.8025590181350708,
          0.9777120351791382,
          0.8160456418991089,
          0.9789234399795532
        ]
      }
    }
  },
  "baseline_threshold_analysis": {
    "partial": 0.32500000000000007,
    "exact": 0.6750000000000004,
    "best_macro_f1": 0.8221997300944669,
    "near_optimal_count": 9,
    "near_optimal_partial_range": [
      0.3000000000000001,
      0.5250000000000001
    ],
    "near_optimal_exact_range": [
      0.6500000000000002,
      0.7000000000000004
    ]
  },
  "candidate_validation_results": [
    {
      "name": "conservative",
      "epochs": 1,
      "learning_rate": 5e-06,
      "batch_size": 8,
      "seed": 13,
      "weights_updated": true,
      "duration_seconds": 22.881541599985212,
      "epoch_training_loss": [
        0.0812509436160326
      ],
      "checkpoint": "C:\\Users\\walid bousnina\\Downloads\\AI Recruiter Platform Design\\backend\\training_experiments\\artifacts_v2\\candidates\\conservative_seed13",
      "threshold_analysis": {
        "partial": 0.32500000000000007,
        "exact": 0.6875000000000004,
        "best_macro_f1": 0.8221997300944669,
        "near_optimal_count": 6,
        "near_optimal_partial_range": [
          0.3000000000000001,
          0.5250000000000001
        ],
        "near_optimal_exact_range": [
          0.6750000000000003,
          0.7000000000000004
        ]
      },
      "validation": {
        "precision_exact": 1.0,
        "recall_exact": 0.9,
        "f1_exact": 0.9473684210526316,
        "macro_f1_three_class": 0.8221997300944669,
        "per_class": {
          "non_equivalent": {
            "precision": 1.0,
            "recall": 0.6,
            "f1": 0.75,
            "support": 5
          },
          "partial": {
            "precision": 0.625,
            "recall": 1.0,
            "f1": 0.7692307692307693,
            "support": 5
          },
          "equivalent": {
            "precision": 1.0,
            "recall": 0.9,
            "f1": 0.9473684210526315,
            "support": 10
          }
        },
        "confusion_matrix_rows_true_cols_predicted": [
          [
            3,
            2,
            0
          ],
          [
            0,
            5,
            0
          ],
          [
            0,
            1,
            9
          ]
        ],
        "similarity_by_relation": {
          "non_equivalent": {
            "mean": 0.3184165060520172,
            "values": [
              0.1020645722746849,
              0.28583788871765137,
              0.22957831621170044,
              0.5045167803764343,
              0.4700848460197449
            ]
          },
          "partial": {
            "mean": 0.49856653809547424,
            "values": [
              0.6518360376358032,
              0.3906358778476715,
              0.3371189832687378,
              0.569647490978241,
              0.543594479560852
            ]
          },
          "equivalent": {
            "mean": 0.8746091723442078,
            "values": [
              0.9269746541976929,
              0.7056392431259155,
              0.6162286996841431,
              0.9784157276153564,
              0.9678403735160828,
              0.9744541645050049,
              0.8035237193107605,
              0.9782568216323853,
              0.8152810335159302,
              0.9794782400131226
            ]
          }
        }
      }
    },
    {
      "name": "conservative",
      "epochs": 1,
      "learning_rate": 5e-06,
      "batch_size": 8,
      "seed": 42,
      "weights_updated": true,
      "duration_seconds": 21.24553640000522,
      "epoch_training_loss": [
        0.08101089671254158
      ],
      "checkpoint": "C:\\Users\\walid bousnina\\Downloads\\AI Recruiter Platform Design\\backend\\training_experiments\\artifacts_v2\\candidates\\conservative_seed42",
      "threshold_analysis": {
        "partial": 0.32500000000000007,
        "exact": 0.6875000000000004,
        "best_macro_f1": 0.8221997300944669,
        "near_optimal_count": 6,
        "near_optimal_partial_range": [
          0.3000000000000001,
          0.5250000000000001
        ],
        "near_optimal_exact_range": [
          0.6750000000000003,
          0.7000000000000004
        ]
      },
      "validation": {
        "precision_exact": 1.0,
        "recall_exact": 0.9,
        "f1_exact": 0.9473684210526316,
        "macro_f1_three_class": 0.8221997300944669,
        "per_class": {
          "non_equivalent": {
            "precision": 1.0,
            "recall": 0.6,
            "f1": 0.75,
            "support": 5
          },
          "partial": {
            "precision": 0.625,
            "recall": 1.0,
            "f1": 0.7692307692307693,
            "support": 5
          },
          "equivalent": {
            "precision": 1.0,
            "recall": 0.9,
            "f1": 0.9473684210526315,
            "support": 10
          }
        },
        "confusion_matrix_rows_true_cols_predicted": [
          [
            3,
            2,
            0
          ],
          [
            0,
            5,
            0
          ],
          [
            0,
            1,
            9
          ]
        ],
        "similarity_by_relation": {
          "non_equivalent": {
            "mean": 0.32340940833091736,
            "values": [
              0.10789813101291656,
              0.28832894563674927,
              0.23411254584789276,
              0.5089492797851562,
              0.4777582287788391
            ]
          },
          "partial": {
            "mean": 0.5034083127975464,
            "values": [
              0.6543278694152832,
              0.3975975513458252,
              0.34605830907821655,
              0.5760830044746399,
              0.5429747104644775
            ]
          },
          "equivalent": {
            "mean": 0.8760213851928711,
            "values": [
              0.9284976720809937,
              0.7078325748443604,
              0.6200640797615051,
              0.9788720011711121,
              0.9696155786514282,
              0.9745743870735168,
              0.803325355052948,
              0.9783270359039307,
              0.8194674253463745,
              0.9796373248100281
            ]
          }
        }
      }
    },
    {
      "name": "moderate",
      "epochs": 1,
      "learning_rate": 1e-05,
      "batch_size": 8,
      "seed": 13,
      "weights_updated": true,
      "duration_seconds": 16.18541620002361,
      "epoch_training_loss": [
        0.08113030605018139
      ],
      "checkpoint": "C:\\Users\\walid bousnina\\Downloads\\AI Recruiter Platform Design\\backend\\training_experiments\\artifacts_v2\\candidates\\moderate_seed13",
      "threshold_analysis": {
        "partial": 0.41250000000000014,
        "exact": 0.6875000000000004,
        "best_macro_f1": 0.8221997300944669,
        "near_optimal_count": 8,
        "near_optimal_partial_range": [
          0.3000000000000001,
          0.5250000000000001
        ],
        "near_optimal_exact_range": [
          0.6750000000000003,
          0.7000000000000004
        ]
      },
      "validation": {
        "precision_exact": 1.0,
        "recall_exact": 0.9,
        "f1_exact": 0.9473684210526316,
        "macro_f1_three_class": 0.6976076555023923,
        "per_class": {
          "non_equivalent": {
            "precision": 0.6,
            "recall": 0.6,
            "f1": 0.6,
            "support": 5
          },
          "partial": {
            "precision": 0.5,
            "recall": 0.6,
            "f1": 0.5454545454545454,
            "support": 5
          },
          "equivalent": {
            "precision": 1.0,
            "recall": 0.9,
            "f1": 0.9473684210526315,
            "support": 10
          }
        },
        "confusion_matrix_rows_true_cols_predicted": [
          [
            3,
            2,
            0
          ],
          [
            2,
            3,
            0
          ],
          [
            0,
            1,
            9
          ]
        ],
        "similarity_by_relation": {
          "non_equivalent": {
            "mean": 0.30943506956100464,
            "values": [
              0.09204477816820145,
              0.27887842059135437,
              0.22517339885234833,
              0.4960690140724182,
              0.4550098776817322
            ]
          },
          "partial": {
            "mean": 0.4928758144378662,
            "values": [
              0.6543917655944824,
              0.38554802536964417,
              0.32856330275535583,
              0.5575416088104248,
              0.5383343696594238
            ]
          },
          "equivalent": {
            "mean": 0.875382125377655,
            "values": [
              0.9267444610595703,
              0.710163950920105,
              0.6166545748710632,
              0.9781564474105835,
              0.9692298173904419,
              0.9746944308280945,
              0.8046629428863525,
              0.9787929654121399,
              0.8147025108337402,
              0.9800189733505249
            ]
          }
        }
      }
    },
    {
      "name": "moderate",
      "epochs": 1,
      "learning_rate": 1e-05,
      "batch_size": 8,
      "seed": 42,
      "weights_updated": true,
      "duration_seconds": 28.527561099966988,
      "epoch_training_loss": [
        0.0813484475016594
      ],
      "checkpoint": "C:\\Users\\walid bousnina\\Downloads\\AI Recruiter Platform Design\\backend\\training_experiments\\artifacts_v2\\candidates\\moderate_seed42",
      "threshold_analysis": {
        "partial": 0.32500000000000007,
        "exact": 0.6875000000000004,
        "best_macro_f1": 0.8221997300944669,
        "near_optimal_count": 6,
        "near_optimal_partial_range": [
          0.3000000000000001,
          0.5250000000000001
        ],
        "near_optimal_exact_range": [
          0.6750000000000003,
          0.7000000000000004
        ]
      },
      "validation": {
        "precision_exact": 1.0,
        "recall_exact": 0.9,
        "f1_exact": 0.9473684210526316,
        "macro_f1_three_class": 0.8221997300944669,
        "per_class": {
          "non_equivalent": {
            "precision": 1.0,
            "recall": 0.6,
            "f1": 0.75,
            "support": 5
          },
          "partial": {
            "precision": 0.625,
            "recall": 1.0,
            "f1": 0.7692307692307693,
            "support": 5
          },
          "equivalent": {
            "precision": 1.0,
            "recall": 0.9,
            "f1": 0.9473684210526315,
            "support": 10
          }
        },
        "confusion_matrix_rows_true_cols_predicted": [
          [
            3,
            2,
            0
          ],
          [
            0,
            5,
            0
          ],
          [
            0,
            1,
            9
          ]
        ],
        "similarity_by_relation": {
          "non_equivalent": {
            "mean": 0.3187384605407715,
            "values": [
              0.1027451902627945,
              0.28335100412368774,
              0.23368723690509796,
              0.5044927597045898,
              0.469416081905365
            ]
          },
          "partial": {
            "mean": 0.5020125508308411,
            "values": [
              0.6590923070907593,
              0.3985444903373718,
              0.3454676866531372,
              0.5699511766433716,
              0.5370070338249207
            ]
          },
          "equivalent": {
            "mean": 0.8779906034469604,
            "values": [
              0.9296749830245972,
              0.7140437364578247,
              0.6238903403282166,
              0.9790189266204834,
              0.9724703431129456,
              0.9748764038085938,
              0.8040277361869812,
              0.9788895845413208,
              0.8226845264434814,
              0.9803295731544495
            ]
          }
        }
      }
    }
  ],
  "setting_mean_validation_macro_f1": {
    "conservative": 0.8221997300944669,
    "moderate": 0.7599036927984296
  },
  "selected_candidate": {
    "name": "conservative",
    "epochs": 1,
    "learning_rate": 5e-06,
    "batch_size": 8,
    "seed": 13,
    "weights_updated": true,
    "duration_seconds": 22.881541599985212,
    "epoch_training_loss": [
      0.0812509436160326
    ],
    "checkpoint": "C:\\Users\\walid bousnina\\Downloads\\AI Recruiter Platform Design\\backend\\training_experiments\\artifacts_v2\\candidates\\conservative_seed13",
    "threshold_analysis": {
      "partial": 0.32500000000000007,
      "exact": 0.6875000000000004,
      "best_macro_f1": 0.8221997300944669,
      "near_optimal_count": 6,
      "near_optimal_partial_range": [
        0.3000000000000001,
        0.5250000000000001
      ],
      "near_optimal_exact_range": [
        0.6750000000000003,
        0.7000000000000004
      ]
    }
  },
  "baseline_final_test": {
    "precision_exact": 1.0,
    "recall_exact": 0.9,
    "f1_exact": 0.9473684210526316,
    "macro_f1_three_class": 0.46963562753036436,
    "per_class": {
      "non_equivalent": {
        "precision": 0.375,
        "recall": 0.6,
        "f1": 0.46153846153846156,
        "support": 5
      },
      "partial": {
        "precision": 0.0,
        "recall": 0.0,
        "f1": 0.0,
        "support": 5
      },
      "equivalent": {
        "precision": 1.0,
        "recall": 0.9,
        "f1": 0.9473684210526315,
        "support": 10
      }
    },
    "confusion_matrix_rows_true_cols_predicted": [
      [
        3,
        2,
        0
      ],
      [
        5,
        0,
        0
      ],
      [
        0,
        1,
        9
      ]
    ],
    "similarity_by_relation": {
      "non_equivalent": {
        "mean": 0.30003172159194946,
        "values": [
          0.3629690408706665,
          0.2888439893722534,
          0.22055639326572418,
          0.13323882222175598,
          0.49455034732818604
        ]
      },
      "partial": {
        "mean": 0.1398753523826599,
        "values": [
          0.09224659204483032,
          0.04713042080402374,
          0.22888454794883728,
          0.12007799744606018,
          0.21103718876838684
        ]
      },
      "equivalent": {
        "mean": 0.9066928625106812,
        "values": [
          0.9960637092590332,
          0.9868285655975342,
          0.6178425550460815,
          0.9418649077415466,
          0.9819349646568298,
          0.9763115644454956,
          0.9187071323394775,
          0.9871010780334473,
          0.9722168445587158,
          0.6880582571029663
        ]
      }
    }
  },
  "selected_final_test": {
    "precision_exact": 1.0,
    "recall_exact": 0.9,
    "f1_exact": 0.9473684210526316,
    "macro_f1_three_class": 0.46963562753036436,
    "per_class": {
      "non_equivalent": {
        "precision": 0.375,
        "recall": 0.6,
        "f1": 0.46153846153846156,
        "support": 5
      },
      "partial": {
        "precision": 0.0,
        "recall": 0.0,
        "f1": 0.0,
        "support": 5
      },
      "equivalent": {
        "precision": 1.0,
        "recall": 0.9,
        "f1": 0.9473684210526315,
        "support": 10
      }
    },
    "confusion_matrix_rows_true_cols_predicted": [
      [
        3,
        2,
        0
      ],
      [
        5,
        0,
        0
      ],
      [
        0,
        1,
        9
      ]
    ],
    "similarity_by_relation": {
      "non_equivalent": {
        "mean": 0.2924066483974457,
        "values": [
          0.3574216365814209,
          0.286641001701355,
          0.20508265495300293,
          0.11816767603158951,
          0.49472033977508545
        ]
      },
      "partial": {
        "mean": 0.13727794587612152,
        "values": [
          0.09123930335044861,
          0.04899788647890091,
          0.22020980715751648,
          0.11541509628295898,
          0.21052765846252441
        ]
      },
      "equivalent": {
        "mean": 0.906836986541748,
        "values": [
          0.996286153793335,
          0.9868265986442566,
          0.6223466396331787,
          0.9414302110671997,
          0.9821087121963501,
          0.9764608144760132,
          0.9160221815109253,
          0.9865872859954834,
          0.9725818037986755,
          0.6877195835113525
        ]
      }
    }
  },
  "selected_checkpoint": "C:\\Users\\walid bousnina\\Downloads\\AI Recruiter Platform Design\\backend\\training_experiments\\artifacts_v2\\selected_model",
  "uncertainty": "Small synthetic splits; four candidate runs and two seeds do not support a production-generalization claim."
}
```
